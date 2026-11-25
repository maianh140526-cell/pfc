import "server-only";
import { randomUUID } from "node:crypto";
import { z } from "zod";
import { all, one, run } from "@/platform/db/client";
import { audit } from "@/platform/audit";
import { ActionError } from "@/platform/errors";
import { allowAttempt } from "@/platform/rate-limit";
import { can, type Actor } from "@/platform/roles";
import { verifyOwnUploadUrls } from "@/platform/uploads/service";
import { EXT_TYPES, GONE_AFTER_DAYS, REFRESH_EVERY_MS, SOURCES, isSourceId, safeHttpsUrl, stateOf, type ExtType, type OppState, type ParsedItem, type SourceId } from "../domain/feed";
import { fetchRemoteOk, fetchUeb, fetchWwr } from "./sources";

const now = () => new Date().toISOString();

export type ExtOpportunity = {
  id: string;
  source: SourceId;
  sourceLabel: string;
  type: ExtType;
  title: string;
  summary: string;
  organization: string;
  location: string;
  imageUrl: string;
  url: string;
  postedAt: string | null;
  deadlineAt: string | null;
  state: OppState;
  rawState: "open" | "closed";
  authorId: string | null;
  authorName: string | null;
  lastSeenAt: string;
  updatedAt: string;
};

type Row = {
  id: string;
  source: string;
  type: ExtType;
  title: string;
  summary: string;
  organization: string;
  location: string;
  image_url: string;
  url: string;
  posted_at: string | null;
  deadline_at: string | null;
  state: "open" | "closed";
  author_id: string | null;
  author_name: string | null;
  last_seen_at: string;
  updated_at: string;
};

const SQL = "SELECT o.*, (SELECT full_name FROM members m WHERE m.id = o.author_id) AS author_name FROM ext_opportunities o";

const toOpp = (r: Row): ExtOpportunity => {
  const source: SourceId = isSourceId(r.source) ? r.source : "pfc";
  return {
    id: r.id,
    source,
    sourceLabel: SOURCES[source].label,
    type: r.type,
    title: r.title,
    summary: r.summary,
    organization: r.organization,
    location: r.location,
    imageUrl: r.image_url,
    url: r.url,
    postedAt: r.posted_at,
    deadlineAt: r.deadline_at,
    state: stateOf({ state: r.state, deadlineAt: r.deadline_at }),
    rawState: r.state,
    authorId: r.author_id,
    authorName: r.author_name,
    lastSeenAt: r.last_seen_at,
    updatedAt: r.updated_at,
  };
};

// ───────────────────────── Reading ─────────────────────────

export async function listExternal(f: { type?: string; source?: string; q?: string; includeClosed?: boolean } = {}): Promise<ExtOpportunity[]> {
  const where: string[] = [];
  const args: string[] = [];
  if ((EXT_TYPES as readonly string[]).includes(f.type ?? "")) (where.push("o.type = ?"), args.push(f.type!));
  if (isSourceId(f.source)) (where.push("o.source = ?"), args.push(f.source));
  if (f.q?.trim()) {
    const like = `%${f.q.trim().replace(/[\\%_]/g, (m) => `\\${m}`)}%`;
    where.push("(o.title LIKE ? ESCAPE '\\' OR o.organization LIKE ? ESCAPE '\\' OR o.summary LIKE ? ESCAPE '\\')");
    args.push(like, like, like);
  }
  if (!f.includeClosed) {
    where.push("o.state = 'open' AND (o.deadline_at IS NULL OR o.deadline_at > ?)");
    args.push(now());
  }
  const rows = await all<Row>(`${SQL} ${where.length ? `WHERE ${where.join(" AND ")}` : ""} ORDER BY (o.source = 'pfc') DESC, COALESCE(o.posted_at, o.created_at) DESC LIMIT 80`, args);
  return rows.map(toOpp);
}

export async function getExternal(id: string): Promise<ExtOpportunity | null> {
  const r = await one<Row>(`${SQL} WHERE o.id = ?`, [id]);
  return r ? toOpp(r) : null;
}

export async function myPosts(actor: Actor): Promise<ExtOpportunity[]> {
  return (await all<Row>(`${SQL} WHERE o.author_id = ? ORDER BY o.updated_at DESC LIMIT 100`, [actor.id])).map(toOpp);
}

export async function feedInfo(): Promise<{ lastRefreshedAt: string | null }> {
  const r = await one<{ t: string | null }>("SELECT MAX(last_seen_at) AS t FROM ext_opportunities WHERE source <> 'pfc'");
  return { lastRefreshedAt: r?.t ?? null };
}

// ───────────────────────── Refreshing the outside sources ─────────────────────────

async function upsert(i: ParsedItem): Promise<void> {
  const t = now();
  await run(
    `INSERT INTO ext_opportunities (id, source, external_id, type, title, summary, organization, location, image_url, url, posted_at, deadline_at, state, last_seen_at, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'open', ?, ?, ?)
     ON CONFLICT (source, external_id) DO UPDATE SET type = excluded.type, title = excluded.title, summary = excluded.summary, organization = excluded.organization,
       location = excluded.location, image_url = excluded.image_url, url = excluded.url, posted_at = COALESCE(excluded.posted_at, ext_opportunities.posted_at),
       deadline_at = COALESCE(excluded.deadline_at, ext_opportunities.deadline_at), state = 'open', last_seen_at = excluded.last_seen_at, updated_at = excluded.updated_at`,
    [randomUUID(), i.source, i.externalId, i.type, i.title, i.summary, i.organization, i.location, i.imageUrl, i.url, i.postedAt, i.deadlineAt, t, t, t],
  );
}

export type RefreshResult = { source: string; ok: boolean; count: number }[];

/** Pulls the outside sources and updates what is stored. Safe to call often; each source is tried independently. */
export async function refreshFeed(): Promise<RefreshResult> {
  const known = new Set((await all<{ external_id: string }>("SELECT external_id FROM ext_opportunities WHERE source = 'ueb'")).map((r) => r.external_id));
  const runs = await Promise.all([fetchRemoteOk(), fetchWwr(), fetchUeb(known)]);
  const out: RefreshResult = [];
  for (const r of runs) {
    for (const item of r.items) await upsert(item);
    out.push({ source: r.source, ok: r.ok, count: r.items.length });
  }
  // Job boards list current openings: a posting missing from its feed for two weeks is treated as closed.
  const cutoff = new Date(Date.now() - GONE_AFTER_DAYS * 86_400_000).toISOString();
  for (const s of out) if (s.ok && (s.source === "remoteok" || s.source === "wwr")) await run("UPDATE ext_opportunities SET state = 'closed', updated_at = ? WHERE source = ? AND state = 'open' AND last_seen_at < ?", [now(), s.source, cutoff]);
  // Housekeeping: drop outside postings that have been closed for two months.
  await run("DELETE FROM ext_opportunities WHERE source <> 'pfc' AND COALESCE(deadline_at, last_seen_at) < ?", [new Date(Date.now() - 60 * 86_400_000).toISOString()]);
  return out;
}

/** Page views trigger a refresh at most once per window (shared across servers through the rate limiter). */
export async function refreshIfStale(): Promise<RefreshResult | null> {
  if (!(await allowAttempt("oppfeed:refresh", 1, REFRESH_EVERY_MS))) return null;
  return refreshFeed();
}

// ───────────────────────── Posts by leaders ─────────────────────────

const postSchema = z.object({
  type: z.enum(EXT_TYPES),
  title: z.string().trim().min(3, "Tiêu đề tối thiểu 3 ký tự.").max(160),
  summary: z.string().trim().min(10, "Mô tả tối thiểu 10 ký tự.").max(2000),
  organization: z.string().trim().min(2, "Nhập đơn vị đăng tuyển / tổ chức.").max(120),
  location: z.string().trim().max(120).default(""),
  url: z.string().trim().max(500).default(""),
  deadlineAt: z.preprocess((v) => (v === "" ? null : v), z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Ngày hết hạn không hợp lệ.").nullable()).default(null),
  images: z.array(z.string()).max(1).default([]),
});

function requirePoster(actor: Actor) {
  if (!can(actor, "opp.post")) throw new ActionError("Chỉ Ban điều hành và Trưởng ban được đăng cơ hội.");
}

function prepare(d: z.infer<typeof postSchema>) {
  const url = d.url ? safeHttpsUrl(d.url) : "";
  if (d.url && !url) throw new ActionError("Link đăng ký phải bắt đầu bằng https://");
  // Deadline = end of that day in Vietnam (UTC+7).
  const deadlineAt = d.deadlineAt ? new Date(`${d.deadlineAt}T23:59:59+07:00`).toISOString() : null;
  return { url, deadlineAt };
}

export async function createPost(actor: Actor, input: unknown): Promise<string> {
  requirePoster(actor);
  const d = postSchema.parse(input);
  const { url, deadlineAt } = prepare(d);
  const images = await verifyOwnUploadUrls(actor, "opportunity", d.images, 1);
  const id = randomUUID();
  const t = now();
  await run(
    `INSERT INTO ext_opportunities (id, source, external_id, type, title, summary, organization, location, image_url, url, posted_at, deadline_at, state, author_id, last_seen_at, created_at, updated_at)
     VALUES (?, 'pfc', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'open', ?, ?, ?, ?)`,
    [id, id, d.type, d.title, d.summary, d.organization, d.location, images[0] ?? "", url, t, deadlineAt, actor.id, t, t, t],
  );
  await audit(actor.id, "opp.post.create", `ext_opp:${id}`, "success");
  return id;
}

async function ownPost(actor: Actor, id: string) {
  requirePoster(actor);
  const r = await one<{ author_id: string | null; source: string }>("SELECT author_id, source FROM ext_opportunities WHERE id = ?", [id]);
  if (!r || r.source !== "pfc") throw new ActionError("Không tìm thấy tin đăng.");
  if (r.author_id !== actor.id && !can(actor, "admin.dashboard")) throw new ActionError("Bạn chỉ sửa được tin do mình đăng.");
  return r;
}

export async function updatePost(actor: Actor, id: string, input: unknown): Promise<void> {
  await ownPost(actor, id);
  const d = postSchema.parse(input);
  const { url, deadlineAt } = prepare(d);
  const images = await verifyOwnUploadUrls(actor, "opportunity", d.images, 1);
  await run("UPDATE ext_opportunities SET type = ?, title = ?, summary = ?, organization = ?, location = ?, image_url = ?, url = ?, deadline_at = ?, updated_at = ? WHERE id = ?", [
    d.type,
    d.title,
    d.summary,
    d.organization,
    d.location,
    images[0] ?? "",
    url,
    deadlineAt,
    now(),
    id,
  ]);
  await audit(actor.id, "opp.post.update", `ext_opp:${id}`, "success");
}

/** Close or reopen a posting (e.g. positions filled, applications extended). */
export async function setPostState(actor: Actor, id: string, state: "open" | "closed"): Promise<void> {
  await ownPost(actor, id);
  await run("UPDATE ext_opportunities SET state = ?, updated_at = ? WHERE id = ?", [state, now(), id]);
  await audit(actor.id, `opp.post.${state === "open" ? "reopen" : "close"}`, `ext_opp:${id}`, "success");
}

export async function deletePost(actor: Actor, id: string): Promise<void> {
  await ownPost(actor, id);
  await run("DELETE FROM ext_opportunities WHERE id = ?", [id]);
  await audit(actor.id, "opp.post.delete", `ext_opp:${id}`, "success");
}

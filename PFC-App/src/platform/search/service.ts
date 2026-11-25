import "server-only";
import { all } from "@/platform/db/client";
import { publicOpportunities } from "@/platform/hub-proxy/public";
import type { Actor } from "@/platform/roles";

/**
 * Global search (SYS-09/10, SRCH-01/02). Only content the actor may see:
 * published courses/resources/listings, public projects, visible forum threads, verified opportunities,
 * members who allow it (privacy.profileVisibility), and the actor's OWN finance transactions.
 */
export const SEARCH_TYPES = {
  course: "Khóa học",
  opportunity: "Cơ hội",
  project: "Dự án",
  listing: "Sản phẩm",
  resource: "Tài liệu",
  thread: "Diễn đàn",
  post: "Bài viết cộng đồng",
  group: "Nhóm",
  member: "Mọi người",
  transaction: "Giao dịch của tôi",
} as const;
export type SearchType = keyof typeof SEARCH_TYPES;

export type SearchHit = { type: SearchType; id: string; title: string; subtitle: string; href: string | null; image?: string | null; amount?: number };

const like = (q: string) => `%${q.replace(/[\\%_]/g, (m) => `\\${m}`)}%`;

export function normaliseQuery(raw: unknown): string {
  return typeof raw === "string" ? raw.replace(/\s+/g, " ").trim().slice(0, 80) : "";
}

export async function search(actor: Actor | null, rawQ: unknown, only?: SearchType, perType = 5): Promise<{ q: string; groups: Partial<Record<SearchType, SearchHit[]>> }> {
  const q = normaliseQuery(rawQ);
  if (q.length < 2) return { q, groups: {} };
  const L = like(q);
  const n = Math.min(Math.max(perType, 1), 30);
  const want = (t: SearchType) => !only || only === t;
  const tasks: Promise<[SearchType, SearchHit[]]>[] = [];

  if (want("course"))
    tasks.push(
      all<{ id: string; title: string; summary: string; level: string }>(
        "SELECT id, title, summary, level FROM edu_courses WHERE status = 'published' AND (title LIKE ? ESCAPE '\\' OR summary LIKE ? ESCAPE '\\' OR topic LIKE ? ESCAPE '\\') ORDER BY published_at DESC LIMIT ?",
        [L, L, L, n],
      ).then((r) => ["course", r.map((x) => ({ type: "course", id: x.id, title: x.title, subtitle: x.summary, href: `/learn/courses/${x.id}` }))]),
    );
  if (want("resource"))
    tasks.push(
      all<{ id: string; title: string; kind: string }>(
        "SELECT id, title, kind FROM edu_resources WHERE status = 'published' AND (title LIKE ? ESCAPE '\\' OR description LIKE ? ESCAPE '\\') ORDER BY updated_at DESC LIMIT ?",
        [L, L, n],
      ).then((r) => ["resource", r.map((x) => ({ type: "resource", id: x.id, title: x.title, subtitle: "Tài liệu", href: "/learn/resources" }))]),
    );
  if (want("thread"))
    tasks.push(
      all<{ id: string; title: string; topic: string }>(
        "SELECT id, title, topic FROM edu_threads WHERE hidden = 0 AND (title LIKE ? ESCAPE '\\' OR body LIKE ? ESCAPE '\\') ORDER BY last_activity_at DESC LIMIT ?",
        [L, L, n],
      ).then((r) => ["thread", r.map((x) => ({ type: "thread", id: x.id, title: x.title, subtitle: "Diễn đàn", href: `/learn/forum/${x.id}` }))]),
    );
  if (want("post"))
    tasks.push(
      all<{ id: string; title: string; body: string; author: string }>(
        `SELECT p.id, p.title, p.body, m.full_name AS author FROM com_posts p JOIN members m ON m.id = p.author_id LEFT JOIN com_groups g ON g.id = p.group_id
         WHERE p.status = 'published' AND (p.group_id IS NULL OR (g.status = 'active' AND g.visibility = 'public'))
           AND (p.title LIKE ? ESCAPE '\\' OR p.body LIKE ? ESCAPE '\\') ORDER BY p.last_activity_at DESC LIMIT ?`,
        [L, L, n],
      ).then((r) => ["post", r.map((x) => ({ type: "post", id: x.id, title: x.title || x.body.slice(0, 80), subtitle: x.author, href: `/community/posts/${x.id}` }))]),
    );
  if (want("group"))
    tasks.push(
      all<{ id: string; name: string; description: string }>(
        "SELECT id, name, description FROM com_groups WHERE status = 'active' AND (name LIKE ? ESCAPE '\\' OR description LIKE ? ESCAPE '\\') ORDER BY created_at DESC LIMIT ?",
        [L, L, n],
      ).then((r) => ["group", r.map((x) => ({ type: "group", id: x.id, title: x.name, subtitle: x.description || "Nhóm cộng đồng", href: `/community/groups/${x.id}` }))]),
    );
  if (want("listing"))
    tasks.push(
      all<{ id: string; title: string; price: number; images: string }>(
        "SELECT id, title, price, images FROM mkt_listings WHERE status = 'published' AND (title LIKE ? ESCAPE '\\' OR description LIKE ? ESCAPE '\\') ORDER BY updated_at DESC LIMIT ?",
        [L, L, n],
      ).then((r) => [
        "listing",
        r.map((x) => {
          let image: string | null = null;
          try {
            const imgs = JSON.parse(x.images) as unknown;
            image = Array.isArray(imgs) && typeof imgs[0] === "string" ? imgs[0] : null;
          } catch {
            image = null;
          }
          return { type: "listing", id: x.id, title: x.title, subtitle: "Marketplace", href: `/market/p/${x.id}`, image, amount: Number(x.price) };
        }),
      ]),
    );
  if (want("project"))
    tasks.push(
      all<{ id: string; title: string; summary: string }>(
        "SELECT id, title, summary FROM prj_projects WHERE status IN ('active','completed') AND (title LIKE ? ESCAPE '\\' OR summary LIKE ? ESCAPE '\\' OR skills LIKE ? ESCAPE '\\') ORDER BY updated_at DESC LIMIT ?",
        [L, L, L, n],
      ).then((r) => ["project", r.map((x) => ({ type: "project", id: x.id, title: x.title, subtitle: x.summary, href: `/projects/p/${x.id}` }))]),
    );
  if (want("opportunity"))
    tasks.push(
      publicOpportunities(q, n).then((r) => [
        "opportunity",
        (r?.items ?? []).map((o) => ({ type: "opportunity", id: o.id, title: o.title, subtitle: o.provider ?? "Cơ hội", href: `/opportunities/${o.id}` })),
      ]),
    );
  if (actor && want("member"))
    tasks.push(
      all<{ id: string; full_name: string; avatar_url: string | null; bio: string }>(
        `SELECT id, full_name, avatar_url, bio FROM members
         WHERE deleted_at IS NULL AND locked = 0 AND full_name LIKE ? ESCAPE '\\'
           AND (id = ? OR COALESCE(json_extract(privacy, '$.profileVisibility'), 'members') = 'members')
         ORDER BY full_name LIMIT ?`,
        [L, actor.id, n],
      ).then((r) => ["member", r.map((x) => ({ type: "member", id: x.id, title: x.full_name, subtitle: x.bio || "Thành viên PFC", href: `/members/${x.id}`, image: x.avatar_url }))]),
    );
  if (actor && want("transaction"))
    tasks.push(
      all<{ id: string; note: string; amount: number; type: string; occurred_at: string; category: string | null }>(
        `SELECT t.id, t.note, t.amount, t.type, t.occurred_at, c.name AS category FROM fin_transactions t LEFT JOIN fin_categories c ON c.id = t.category_id
         WHERE t.member_id = ? AND (t.note LIKE ? ESCAPE '\\' OR c.name LIKE ? ESCAPE '\\') ORDER BY t.occurred_at DESC LIMIT ?`,
        [actor.id, L, L, n],
      ).then((r) => [
        "transaction",
        r.map((x) => ({
          type: "transaction",
          id: x.id,
          title: x.note || x.category || "Giao dịch",
          subtitle: `${x.category ?? ""} · ${x.occurred_at.slice(0, 10).split("-").reverse().join("/")}`,
          href: `/finance/transactions/${x.id}`,
          amount: x.type === "expense" ? -Number(x.amount) : Number(x.amount),
        })),
      ]),
    );

  const groups: Partial<Record<SearchType, SearchHit[]>> = {};
  for (const [t, hits] of await Promise.all(tasks)) if (hits.length) groups[t] = hits;
  return { q, groups };
}

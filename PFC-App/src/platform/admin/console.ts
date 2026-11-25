import "server-only";
import { randomUUID } from "node:crypto";
import { z } from "zod";
import { audit } from "@/platform/audit";
import { all, one, run } from "@/platform/db/client";
import { checkEnv } from "@/platform/env";
import { ActionError } from "@/platform/errors";
import { notify } from "@/platform/notifications/service";
import { allowAttempt } from "@/platform/rate-limit";
import { DEPARTMENTS, ROLES, can, isDepartment, isRole, type Actor, type Permission } from "@/platform/roles";
import { RESTRICTION_KINDS, type RestrictionKind } from "./restrictions";

/** G8 Admin console (ADM-*, IAM-A*, NOT-A*). Every function checks its permission here. */
const now = () => new Date().toISOString();
const daysAgo = (d: number) => new Date(Date.now() - d * 86_400_000).toISOString();
const n = async (sql: string, args: (string | number)[] = []) => Number((await one<{ n: number }>(sql, args))?.n ?? 0);

function need(actor: Actor, p: Permission, msg = "Bạn không có quyền truy cập trang quản trị này.") {
  if (!can(actor, p)) throw new ActionError(msg);
}

// ───────────────────────── Dashboard ─────────────────────────

export type Queue = { key: string; label: string; count: number; href: string };

/** Moderation and approval queues of every hub, filtered to what this actor may act on. */
export async function queues(actor: Actor): Promise<Queue[]> {
  const q: (Queue & { perm: Permission })[] = [
    { key: "reports", label: "Báo cáo vi phạm cộng đồng", perm: "community.moderate", href: "/community/manage", count: await n("SELECT COUNT(*) AS n FROM com_reports WHERE status = 'open'") },
    { key: "listings", label: "Tin đăng bán chờ duyệt", perm: "mkt.listing.approve", href: "/market/manage", count: await n("SELECT COUNT(*) AS n FROM mkt_listings WHERE status = 'submitted'") },
    { key: "sellers", label: "Cửa hàng chờ xác minh", perm: "mkt.seller.approve", href: "/market/manage", count: await n("SELECT COUNT(*) AS n FROM mkt_sellers WHERE status = 'pending' OR verify_status = 'pending'") },
    {
      key: "learn",
      label: "Nội dung học tập chờ duyệt",
      perm: "edu.content.approve",
      href: "/learn/manage",
      count: await n("SELECT (SELECT COUNT(*) FROM edu_courses WHERE status = 'submitted') + (SELECT COUNT(*) FROM edu_quizzes WHERE status = 'submitted') + (SELECT COUNT(*) FROM edu_resources WHERE status = 'submitted') AS n"),
    },
    { key: "projects", label: "Dự án chờ duyệt", perm: "project.approve", href: "/projects/manage", count: await n("SELECT COUNT(*) AS n FROM prj_projects WHERE status = 'submitted'") },
    { key: "events", label: "Sự kiện chờ duyệt", perm: "event.approve", href: "/events/review", count: await n("SELECT COUNT(*) AS n FROM evt_events WHERE status = 'submitted'") },
    { key: "refunds", label: "Hoàn tiền đang mở", perm: "payments.view", href: "/payments/refunds", count: await n("SELECT COUNT(*) AS n FROM refunds WHERE status IN ('requested','approved','processing')") },
    { key: "payouts", label: "Lệnh chi chờ chuyển khoản", perm: "payments.view", href: "/payments/manage", count: await n("SELECT COUNT(*) AS n FROM payouts WHERE status = 'pending'") },
    { key: "redemptions", label: "Yêu cầu đổi quà", perm: "rewards.manage", href: "/admin/rewards", count: await n("SELECT COUNT(*) AS n FROM pts_redemptions WHERE status = 'requested'") },
    { key: "support", label: "Yêu cầu hỗ trợ chưa trả lời", perm: "admin.support", href: "/admin/support", count: await n("SELECT COUNT(*) AS n FROM support_tickets WHERE status = 'open'") },
  ];
  return q.filter((x) => can(actor, x.perm)).map(({ perm: _p, ...x }) => x);
}

export async function dashboard(actor: Actor) {
  need(actor, "admin.dashboard");
  const [members, newMembers, active7, locked, posts7, orders30, gmv30, events, registrations30, tickets] = await Promise.all([
    n("SELECT COUNT(*) AS n FROM members WHERE deleted_at IS NULL"),
    n("SELECT COUNT(*) AS n FROM members WHERE deleted_at IS NULL AND created_at >= ?", [daysAgo(7)]),
    n("SELECT COUNT(DISTINCT member_id) AS n FROM member_sessions WHERE last_seen_at >= ?", [daysAgo(7)]),
    n("SELECT COUNT(*) AS n FROM members WHERE locked = 1 AND deleted_at IS NULL"),
    n("SELECT COUNT(*) AS n FROM com_posts WHERE status = 'published' AND created_at >= ?", [daysAgo(7)]),
    n("SELECT COUNT(*) AS n FROM mkt_orders WHERE created_at >= ?", [daysAgo(30)]),
    n("SELECT COALESCE(SUM(amount),0) AS n FROM payments WHERE status IN ('succeeded','partially_refunded') AND created_at >= ?", [daysAgo(30)]),
    n("SELECT COUNT(*) AS n FROM evt_events WHERE status = 'published'"),
    n("SELECT COUNT(*) AS n FROM evt_registrations WHERE status = 'confirmed' AND created_at >= ?", [daysAgo(30)]),
    n("SELECT COUNT(*) AS n FROM support_tickets WHERE status = 'open'"),
  ]);
  const env = checkEnv(process.env, process.env.NODE_ENV === "production" && process.env.PFC_ENV !== "local");
  let db = "up";
  try {
    await one("SELECT 1 AS x");
  } catch {
    db = "down";
  }
  return {
    kpis: { members, newMembers, active7, locked, posts7, orders30, gmv30, events, registrations30, tickets },
    system: { db, problems: env.problems.map((p) => p.split(":")[0]), warnings: env.warnings.length, dbKind: (process.env.PFC_DB_URL ?? "").startsWith("libsql://") ? "Turso" : "SQLite (máy dev)" },
    queues: await queues(actor),
  };
}

// ───────────────────────── Members & restrictions ─────────────────────────

export async function memberDetail(actor: Actor, id: string) {
  need(actor, "admin.members.view");
  const m = await one<{ id: string; email: string; full_name: string; role: string; department: string | null; locked: number; created_at: string; deleted_at: string | null; email_verified_at: string | null; onboarded_at: string | null }>(
    "SELECT id, email, full_name, role, department, locked, created_at, deleted_at, email_verified_at, onboarded_at FROM members WHERE id = ?",
    [id],
  );
  if (!m) return null;
  const restrictions = await all<{ id: string; kind: RestrictionKind; reason: string; until: string | null; created_at: string; lifted_at: string | null; by_name: string | null }>(
    "SELECT r.id, r.kind, r.reason, r.until, r.created_at, r.lifted_at, b.full_name AS by_name FROM member_restrictions r LEFT JOIN members b ON b.id = r.created_by WHERE r.member_id = ? ORDER BY r.created_at DESC LIMIT 50",
    [id],
  );
  const activity = await all<{ action: string; result: string; created_at: string }>("SELECT action, result, created_at FROM audit_log WHERE actor_id = ? ORDER BY created_at DESC LIMIT 20", [id]);
  const sessions = await n("SELECT COUNT(*) AS n FROM member_sessions WHERE member_id = ? AND revoked_at IS NULL", [id]);
  const lastSeen = (await one<{ t: string | null }>("SELECT MAX(last_seen_at) AS t FROM member_sessions WHERE member_id = ?", [id]))?.t ?? null;
  const stats = {
    posts: await n("SELECT COUNT(*) AS n FROM com_posts WHERE author_id = ? AND status != 'deleted'", [id]),
    reportsAgainst: await n("SELECT COUNT(*) AS n FROM com_reports r WHERE (r.target_type = 'member' AND r.target_id = ?) OR (r.target_type = 'post' AND r.target_id IN (SELECT id FROM com_posts WHERE author_id = ?))", [id, id]),
    orders: await n("SELECT COUNT(*) AS n FROM mkt_orders WHERE buyer_id = ? OR seller_id = ?", [id, id]),
    events: await n("SELECT COUNT(*) AS n FROM evt_registrations WHERE member_id = ? AND status = 'confirmed'", [id]),
  };
  const t = Date.now();
  return {
    id: m.id,
    email: m.email,
    name: m.full_name,
    role: isRole(m.role) ? m.role : "thanh_vien",
    department: isDepartment(m.department) ? m.department : null,
    locked: !!m.locked,
    deleted: !!m.deleted_at,
    verified: !!m.email_verified_at,
    onboarded: !!m.onboarded_at,
    createdAt: m.created_at,
    sessions,
    lastSeen,
    stats,
    restrictions: restrictions.map((r) => ({ id: r.id, kind: r.kind, reason: r.reason, until: r.until, createdAt: r.created_at, by: r.by_name, active: !r.lifted_at && (!r.until || Date.parse(r.until) > t), liftedAt: r.lifted_at })),
    activity: activity.map((a) => ({ action: a.action, result: a.result, at: a.created_at })),
    canRestrict: can(actor, "admin.members.restrict") && actor.id !== id,
  };
}

const RANK: Record<string, number> = { chu_nhiem: 3, ban_dieu_hanh: 2, truong_ban: 1, thanh_vien: 0 };

/** Temporary restriction (never a delete): reason required, visible to the member when they hit it. */
export async function restrict(actor: Actor, memberId: string, input: unknown): Promise<string> {
  need(actor, "admin.members.restrict", "Bạn không có quyền hạn chế tài khoản.");
  if (memberId === actor.id) throw new ActionError("Không thể tự hạn chế tài khoản của mình.");
  const d = z
    .object({
      kind: z.enum(Object.keys(RESTRICTION_KINDS) as [RestrictionKind, ...RestrictionKind[]]),
      reason: z.string().trim().min(5, "Cần ghi lý do (thành viên sẽ thấy).").max(300),
      days: z.preprocess((v) => (v === "" || v === null || v === undefined ? null : v), z.union([z.null(), z.coerce.number().int().min(1).max(365)])),
    })
    .parse(input);
  const target = await one<{ role: string }>("SELECT role FROM members WHERE id = ? AND deleted_at IS NULL", [memberId]);
  if (!target) throw new ActionError("Không tìm thấy tài khoản.");
  if (actor.role !== "chu_nhiem" && (RANK[target.role] ?? 0) >= RANK[actor.role]) throw new ActionError("Không thể hạn chế người có vai trò ngang hoặc cao hơn bạn.");
  if (target.role === "chu_nhiem") throw new ActionError("Không thể hạn chế Chủ nhiệm.");
  const id = randomUUID();
  const until = d.days ? new Date(Date.now() + d.days * 86_400_000).toISOString() : null;
  await run("INSERT INTO member_restrictions (id, member_id, kind, reason, until, created_by, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)", [id, memberId, d.kind, d.reason, until, actor.id, now()]);
  await audit(actor.id, `admin.restrict.${d.kind}`, `member:${memberId}`, "success");
  await notify(memberId, {
    category: "account",
    title: `Tài khoản bị hạn chế: ${RESTRICTION_KINDS[d.kind]}`,
    body: `${d.reason}${until ? ` (đến ${new Date(until).toLocaleDateString("vi-VN", { timeZone: "Asia/Ho_Chi_Minh" })})` : ""}. Liên hệ hỗ trợ nếu bạn cần giải thích.`,
    href: "/more/support",
  });
  return id;
}

export async function liftRestriction(actor: Actor, restrictionId: string): Promise<void> {
  need(actor, "admin.members.restrict", "Bạn không có quyền hạn chế tài khoản.");
  const r = await one<{ member_id: string; kind: RestrictionKind }>("SELECT member_id, kind FROM member_restrictions WHERE id = ? AND lifted_at IS NULL", [restrictionId]);
  if (!r) throw new ActionError("Hạn chế không còn hiệu lực.");
  await run("UPDATE member_restrictions SET lifted_at = ?, lifted_by = ? WHERE id = ?", [now(), actor.id, restrictionId]);
  await audit(actor.id, `admin.unrestrict.${r.kind}`, `member:${r.member_id}`, "success");
  await notify(r.member_id, { category: "account", title: `Đã gỡ hạn chế: ${RESTRICTION_KINDS[r.kind]}` });
}

// ───────────────────────── Audit log & security events ─────────────────────────

export const SECURITY_PREFIXES = ["member.login", "member.reset", "member.change_password", "member.email_change", "member.2fa", "member.session", "member.link", "member.unlink", "member.delete_account", "member.export_data", "admin."];

export async function auditLog(actor: Actor, f: { q?: string; result?: string; view?: "all" | "security" | "data" } = {}) {
  need(actor, "admin.audit.view", "Bạn không có quyền xem nhật ký hệ thống.");
  const where: string[] = [];
  const args: string[] = [];
  if (f.view === "security") where.push(`(${SECURITY_PREFIXES.map(() => "a.action LIKE ?").join(" OR ")})`), args.push(...SECURITY_PREFIXES.map((p) => `${p}%`));
  if (f.view === "data") where.push("(a.action LIKE 'member.export_data%' OR a.action LIKE 'member.delete_account%' OR a.action LIKE 'finance.export%')");
  if (f.result === "failure" || f.result === "success") (where.push("a.result = ?"), args.push(f.result));
  if (f.q?.trim()) {
    const L = `%${f.q.trim().replace(/[\\%_]/g, (m) => `\\${m}`)}%`;
    where.push("(a.action LIKE ? ESCAPE '\\' OR a.object_ref LIKE ? ESCAPE '\\' OR m.full_name LIKE ? ESCAPE '\\' OR m.email LIKE ? ESCAPE '\\')");
    args.push(L, L, L, L);
  }
  const rows = await all<{ id: string; actor_id: string | null; name: string | null; action: string; object_ref: string | null; result: string; created_at: string }>(
    `SELECT a.id, a.actor_id, m.full_name AS name, a.action, a.object_ref, a.result, a.created_at FROM audit_log a LEFT JOIN members m ON m.id = a.actor_id
     ${where.length ? `WHERE ${where.join(" AND ")}` : ""} ORDER BY a.created_at DESC LIMIT 200`,
    args,
  );
  return rows.map((r) => ({ id: r.id, actorId: r.actor_id, actorName: r.name, action: r.action, objectRef: r.object_ref, result: r.result as "success" | "failure", at: r.created_at }));
}

// ───────────────────────── Broadcast notifications (NOT-A01…A03) ─────────────────────────

const audienceSchema = z.object({
  roles: z.array(z.enum(ROLES)).max(4).default([]),
  departments: z.array(z.enum(DEPARTMENTS)).max(3).default([]),
});
const campaignSchema = z.object({
  title: z.string().trim().min(5, "Tiêu đề tối thiểu 5 ký tự.").max(120),
  body: z.string().trim().max(500).default(""),
  href: z
    .string()
    .trim()
    .max(200)
    .refine((v) => v === "" || (v.startsWith("/") && !v.startsWith("//")), "Liên kết phải là một trang trong app, bắt đầu bằng /.")
    .default(""),
  audience: audienceSchema,
});

async function recipients(aud: z.infer<typeof audienceSchema>): Promise<string[]> {
  const where = ["deleted_at IS NULL", "locked = 0"];
  const args: string[] = [];
  if (aud.roles.length) (where.push(`role IN (${aud.roles.map(() => "?").join(",")})`), args.push(...aud.roles));
  if (aud.departments.length) (where.push(`department IN (${aud.departments.map(() => "?").join(",")})`), args.push(...aud.departments));
  return (await all<{ id: string }>(`SELECT id FROM members WHERE ${where.join(" AND ")}`, args)).map((r) => r.id);
}

export async function previewAudience(actor: Actor, audience: unknown): Promise<number> {
  need(actor, "admin.broadcast", "Bạn không có quyền gửi thông báo chung.");
  return (await recipients(audienceSchema.parse(audience))).length;
}

/** Sends at once (in-app + push per member preferences; email off by default for announcements). */
export async function sendCampaign(actor: Actor, input: unknown): Promise<{ id: string; recipients: number }> {
  need(actor, "admin.broadcast", "Bạn không có quyền gửi thông báo chung.");
  const d = campaignSchema.parse(input);
  if (!(await allowAttempt(`broadcast:${actor.id}`, 5, 3600_000))) throw new ActionError("Bạn đã gửi nhiều thông báo trong 1 giờ qua. Thử lại sau.", "rate_limited");
  const ids = await recipients(d.audience);
  if (!ids.length) throw new ActionError("Không có thành viên nào trong nhóm nhận.");
  const id = randomUUID();
  await run("INSERT INTO notify_campaigns (id, title, body, href, audience, status, recipients, created_by, created_at, sent_at) VALUES (?, ?, ?, ?, ?, 'sent', ?, ?, ?, ?)", [
    id,
    d.title,
    d.body,
    d.href || null,
    JSON.stringify(d.audience),
    ids.length,
    actor.id,
    now(),
    now(),
  ]);
  for (let i = 0; i < ids.length; i += 200) await notify(ids.slice(i, i + 200), { category: "announcements", title: d.title, body: d.body, href: d.href || "/notifications", dedupeKey: `campaign:${id}` });
  await audit(actor.id, "admin.broadcast", `campaign:${id}`, "success");
  return { id, recipients: ids.length };
}

export async function campaigns(actor: Actor) {
  need(actor, "admin.broadcast", "Bạn không có quyền gửi thông báo chung.");
  return (
    await all<{ id: string; title: string; body: string; href: string | null; audience: string; recipients: number; sent_at: string | null; full_name: string }>(
      "SELECT c.*, m.full_name FROM notify_campaigns c JOIN members m ON m.id = c.created_by ORDER BY c.created_at DESC LIMIT 50",
    )
  ).map((c) => ({ id: c.id, title: c.title, body: c.body, href: c.href, audience: JSON.parse(c.audience) as z.infer<typeof audienceSchema>, recipients: Number(c.recipients), sentAt: c.sent_at, by: c.full_name }));
}

// ───────────────────────── Support tickets (SYS help / ADM support) ─────────────────────────

export const SUPPORT_CATEGORIES = { account: "Tài khoản & đăng nhập", payment: "Thanh toán & hoàn tiền", market: "Mua bán", events: "Sự kiện & vé", content: "Báo lỗi nội dung", bug: "Lỗi ứng dụng", other: "Khác" } as const;
export type SupportCategory = keyof typeof SUPPORT_CATEGORIES;
export type TicketStatus = "open" | "answered" | "closed";

export async function createTicket(actor: Actor, input: unknown): Promise<string> {
  const d = z
    .object({
      category: z.enum(Object.keys(SUPPORT_CATEGORIES) as [SupportCategory, ...SupportCategory[]]),
      subject: z.string().trim().min(5, "Tiêu đề tối thiểu 5 ký tự.").max(120),
      body: z.string().trim().min(10, "Mô tả tối thiểu 10 ký tự.").max(4000),
    })
    .parse(input);
  if (!(await allowAttempt(`ticket:${actor.id}`, 5, 24 * 3600_000))) throw new ActionError("Bạn đã gửi nhiều yêu cầu hôm nay. Hãy trả lời trong yêu cầu đang mở.", "rate_limited");
  const id = randomUUID();
  await run("INSERT INTO support_tickets (id, member_id, category, subject, status, created_at, updated_at) VALUES (?, ?, ?, ?, 'open', ?, ?)", [id, actor.id, d.category, d.subject, now(), now()]);
  await run("INSERT INTO support_messages (id, ticket_id, author_id, staff, body, created_at) VALUES (?, ?, ?, 0, ?, ?)", [randomUUID(), id, actor.id, d.body, now()]);
  return id;
}

export type TicketRow = { id: string; subject: string; category: SupportCategory; status: TicketStatus; memberName: string; updatedAt: string };

export async function myTickets(actor: Actor): Promise<TicketRow[]> {
  return ticketRows("WHERE t.member_id = ?", [actor.id]);
}
export async function ticketInbox(actor: Actor, status?: string): Promise<TicketRow[]> {
  need(actor, "admin.support", "Bạn không có quyền xử lý hỗ trợ.");
  return status === "open" || status === "answered" || status === "closed" ? ticketRows("WHERE t.status = ?", [status]) : ticketRows("WHERE t.status != 'closed'", []);
}
async function ticketRows(where: string, args: string[]): Promise<TicketRow[]> {
  return (
    await all<{ id: string; subject: string; category: SupportCategory; status: TicketStatus; full_name: string; updated_at: string }>(
      `SELECT t.id, t.subject, t.category, t.status, m.full_name, t.updated_at FROM support_tickets t JOIN members m ON m.id = t.member_id ${where} ORDER BY t.updated_at DESC LIMIT 100`,
      args,
    )
  ).map((r) => ({ id: r.id, subject: r.subject, category: r.category, status: r.status, memberName: r.full_name, updatedAt: r.updated_at }));
}

export async function getTicket(actor: Actor, id: string) {
  const t = await one<{ id: string; member_id: string; subject: string; category: SupportCategory; status: TicketStatus; created_at: string; full_name: string }>(
    "SELECT t.*, m.full_name FROM support_tickets t JOIN members m ON m.id = t.member_id WHERE t.id = ?",
    [id],
  );
  const staff = can(actor, "admin.support");
  if (!t || (t.member_id !== actor.id && !staff)) return null;
  const msgs = await all<{ id: string; author_id: string; staff: number; body: string; created_at: string; full_name: string | null }>(
    "SELECT s.*, m.full_name FROM support_messages s LEFT JOIN members m ON m.id = s.author_id WHERE s.ticket_id = ? ORDER BY s.created_at",
    [id],
  );
  return {
    id: t.id,
    subject: t.subject,
    category: t.category,
    status: t.status,
    createdAt: t.created_at,
    memberId: t.member_id,
    memberName: t.full_name,
    isStaff: staff,
    messages: msgs.map((m) => ({ id: m.id, staff: !!m.staff, author: m.staff ? "Hỗ trợ PFC" : (m.full_name ?? "Thành viên"), body: m.body, at: m.created_at })),
  };
}

export async function replyTicket(actor: Actor, id: string, body: unknown): Promise<void> {
  const text = z.string().trim().min(1, "Nhập nội dung.").max(4000).parse(body);
  const t = await one<{ member_id: string; status: TicketStatus; subject: string }>("SELECT member_id, status, subject FROM support_tickets WHERE id = ?", [id]);
  if (!t) throw new ActionError("Không tìm thấy yêu cầu.");
  const mine = t.member_id === actor.id;
  const staff = !mine && can(actor, "admin.support");
  if (!mine && !staff) throw new ActionError("Không tìm thấy yêu cầu.");
  await run("INSERT INTO support_messages (id, ticket_id, author_id, staff, body, created_at) VALUES (?, ?, ?, ?, ?, ?)", [randomUUID(), id, actor.id, staff ? 1 : 0, text, now()]);
  await run("UPDATE support_tickets SET status = ?, assignee_id = COALESCE(assignee_id, ?), updated_at = ? WHERE id = ?", [staff ? "answered" : "open", staff ? actor.id : null, now(), id]);
  if (staff) await notify(t.member_id, { category: "support", title: `Hỗ trợ PFC đã trả lời: ${t.subject.slice(0, 60)}`, body: text.slice(0, 140), href: `/more/support/${id}` });
}

export async function closeTicket(actor: Actor, id: string): Promise<void> {
  const t = await one<{ member_id: string }>("SELECT member_id FROM support_tickets WHERE id = ?", [id]);
  if (!t || (t.member_id !== actor.id && !can(actor, "admin.support"))) throw new ActionError("Không tìm thấy yêu cầu.");
  await run("UPDATE support_tickets SET status = 'closed', updated_at = ? WHERE id = ?", [now(), id]);
}

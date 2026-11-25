import "server-only";
import { awardPoints } from "@/modules/rewards/server/service";
import { assertAllowed } from "@/platform/admin/restrictions";
import { randomUUID } from "node:crypto";
import { z } from "zod";
import { all, one, run } from "@/platform/db/client";
import { audit } from "@/platform/audit";
import { ActionError } from "@/platform/errors";
import { notify } from "@/platform/notifications/service";
import { allowAttempt } from "@/platform/rate-limit";
import { can, type Actor } from "@/platform/roles";
import { verifyOwnUploadUrls } from "@/platform/uploads/service";
import {
  REPORT_REASONS,
  TOPICS,
  canReadPost,
  canRemoveFromGroup,
  extractTags,
  groupCaps,
  validatePoll,
  type GroupCaps,
  type GroupRole,
  type GroupVisibility,
  type PostStatus,
  type ReportReason,
  type ReportTarget,
  type Topic,
} from "../domain/rules";

/** Community Hub use-cases (COM-*). Actor-based; every permission checked here. */
const now = () => new Date().toISOString();
const like = (q: string) => `%${q.trim().replace(/[\\%_]/g, (m) => `\\${m}`)}%`;
const isMod = (a: Actor | null) => can(a, "community.moderate");
const parseArr = (raw: string): string[] => {
  try {
    const v = JSON.parse(raw) as unknown;
    return Array.isArray(v) ? v.filter((x): x is string => typeof x === "string") : [];
  } catch {
    return [];
  }
};
const topicEnum = z.enum(Object.keys(TOPICS) as [Topic, ...Topic[]]);

// ───────────────────────── Groups ─────────────────────────

type GroupRow = { id: string; name: string; description: string; topic: Topic; visibility: GroupVisibility; cover_url: string | null; owner_id: string; status: string; archived_reason: string | null; created_at: string };

async function groupRow(id: string) {
  return one<GroupRow>("SELECT * FROM com_groups WHERE id = ?", [id]);
}
async function groupMembership(groupId: string, memberId: string) {
  return one<{ role: GroupRole; status: "active" | "requested" | "banned" }>("SELECT role, status FROM com_group_members WHERE group_id = ? AND member_id = ?", [groupId, memberId]);
}
async function activeGroupRole(groupId: string, memberId: string | null): Promise<GroupRole | null> {
  if (!memberId) return null;
  const m = await groupMembership(groupId, memberId);
  return m?.status === "active" ? m.role : null;
}

const groupSchema = z.object({
  name: z.string().trim().min(3, "Tên nhóm tối thiểu 3 ký tự.").max(60),
  description: z.string().trim().max(1000).default(""),
  topic: topicEnum.default("other"),
  visibility: z.enum(["public", "private"]).default("public"),
  coverUrl: z.string().nullable().optional(),
});

/** COM-14 Create Club/Group. The creator becomes owner. 5 new groups / day / member. */
export async function createGroup(actor: Actor, input: unknown): Promise<string> {
  await assertAllowed(actor.id, "community", "community");
  const d = groupSchema.parse(input);
  if (!(await allowAttempt(`group-create:${actor.id}`, 5, 24 * 3600_000))) throw new ActionError("Bạn đã tạo quá nhiều nhóm hôm nay.", "rate_limited");
  const [cover] = d.coverUrl ? await verifyOwnUploadUrls(actor, "post", [d.coverUrl], 1) : [null];
  const id = randomUUID();
  const t = now();
  await run("INSERT INTO com_groups (id, name, description, topic, visibility, cover_url, owner_id, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)", [
    id,
    d.name,
    d.description,
    d.topic,
    d.visibility,
    cover ?? null,
    actor.id,
    t,
    t,
  ]);
  await run("INSERT INTO com_group_members (group_id, member_id, role, status, created_at) VALUES (?, ?, 'owner', 'active', ?)", [id, actor.id, t]);
  await audit(actor.id, "community.group.create", `group:${id}`, "success");
  return id;
}

export async function updateGroup(actor: Actor, id: string, input: unknown): Promise<void> {
  const g = await groupRow(id);
  if (!g || g.status !== "active") throw new ActionError("Không tìm thấy nhóm.");
  if (!groupCaps(await activeGroupRole(id, actor.id), g.visibility, isMod(actor)).editGroup) throw new ActionError("Chỉ chủ nhóm / điều hành viên được sửa nhóm.");
  const d = groupSchema.parse(input);
  const [cover] = d.coverUrl && d.coverUrl !== g.cover_url ? await verifyOwnUploadUrls(actor, "post", [d.coverUrl], 1) : [d.coverUrl ?? null];
  await run("UPDATE com_groups SET name = ?, description = ?, topic = ?, visibility = ?, cover_url = ?, updated_at = ? WHERE id = ?", [d.name, d.description, d.topic, d.visibility, cover, now(), id]);
}

export type GroupCard = { id: string; name: string; description: string; topic: Topic; visibility: GroupVisibility; coverUrl: string | null; members: number; myStatus: "active" | "requested" | null };

export async function listGroups(actor: Actor | null, f: { q?: string; mine?: boolean } = {}): Promise<GroupCard[]> {
  const where = ["g.status = 'active'"];
  const args: (string | number)[] = [actor?.id ?? ""];
  if (f.q?.trim()) (where.push("(g.name LIKE ? ESCAPE '\\' OR g.description LIKE ? ESCAPE '\\')"), args.push(like(f.q), like(f.q)));
  if (f.mine) where.push("me.status = 'active'");
  const rows = await all<GroupRow & { members: number; my_status: "active" | "requested" | "banned" | null }>(
    `SELECT g.*, (SELECT COUNT(*) FROM com_group_members x WHERE x.group_id = g.id AND x.status = 'active') AS members, me.status AS my_status
     FROM com_groups g LEFT JOIN com_group_members me ON me.group_id = g.id AND me.member_id = ?
     WHERE ${where.join(" AND ")} ORDER BY members DESC, g.created_at DESC LIMIT 100`,
    args,
  );
  return rows.map((r) => ({ id: r.id, name: r.name, description: r.description, topic: r.topic, visibility: r.visibility, coverUrl: r.cover_url, members: Number(r.members), myStatus: r.my_status === "banned" ? null : r.my_status }));
}

export type GroupDetail = GroupCard & { ownerId: string; createdAt: string; myRole: GroupRole | null; caps: GroupCaps; archived: boolean; pending: { memberId: string; name: string }[] };

export async function getGroup(actor: Actor | null, id: string): Promise<GroupDetail | null> {
  const g = await groupRow(id);
  if (!g) return null;
  if (g.status !== "active" && !isMod(actor) && g.owner_id !== actor?.id) return null;
  const mine = actor ? await groupMembership(id, actor.id) : null;
  const myRole = mine?.status === "active" ? mine.role : null;
  const caps = groupCaps(myRole, g.visibility, isMod(actor));
  const members = await one<{ n: number }>("SELECT COUNT(*) AS n FROM com_group_members WHERE group_id = ? AND status = 'active'", [id]);
  const pending = caps.admit
    ? await all<{ memberId: string; name: string }>(
        "SELECT m.id AS memberId, m.full_name AS name FROM com_group_members gm JOIN members m ON m.id = gm.member_id WHERE gm.group_id = ? AND gm.status = 'requested' ORDER BY gm.created_at",
        [id],
      )
    : [];
  return {
    id: g.id,
    name: g.name,
    description: g.description,
    topic: g.topic,
    visibility: g.visibility,
    coverUrl: g.cover_url,
    members: Number(members?.n ?? 0),
    myStatus: mine?.status === "banned" ? null : (mine?.status ?? null),
    ownerId: g.owner_id,
    createdAt: g.created_at,
    myRole,
    caps,
    archived: g.status !== "active",
    pending,
  };
}

export async function groupMembers(actor: Actor | null, id: string): Promise<{ memberId: string; name: string; avatarUrl: string | null; role: GroupRole }[]> {
  const g = await groupRow(id);
  if (!g || !groupCaps(await activeGroupRole(id, actor?.id ?? null), g.visibility, isMod(actor)).viewContent) throw new ActionError("Nhóm riêng tư: chỉ thành viên xem được.");
  return all(
    `SELECT m.id AS memberId, m.full_name AS name, m.avatar_url AS avatarUrl, gm.role FROM com_group_members gm JOIN members m ON m.id = gm.member_id
     WHERE gm.group_id = ? AND gm.status = 'active' ORDER BY CASE gm.role WHEN 'owner' THEN 0 WHEN 'moderator' THEN 1 ELSE 2 END, m.full_name`,
    [id],
  );
}

/** COM-13 Join: public → member at once; private → request for owner / moderators. */
export async function joinGroup(actor: Actor, id: string): Promise<"active" | "requested"> {
  const g = await groupRow(id);
  if (!g || g.status !== "active") throw new ActionError("Không tìm thấy nhóm.");
  const m = await groupMembership(id, actor.id);
  if (m?.status === "active") return "active";
  if (m?.status === "banned") throw new ActionError("Bạn không thể tham gia nhóm này.");
  if (m?.status === "requested") return "requested";
  const status = g.visibility === "public" ? "active" : "requested";
  await run(
    `INSERT INTO com_group_members (group_id, member_id, role, status, created_at) VALUES (?, ?, 'member', ?, ?)
     ON CONFLICT (group_id, member_id) DO UPDATE SET status = excluded.status, role = 'member'`,
    [id, actor.id, status, now()],
  );
  if (status === "requested") {
    const admins = await all<{ member_id: string }>("SELECT member_id FROM com_group_members WHERE group_id = ? AND status = 'active' AND role IN ('owner','moderator')", [id]);
    await notify(admins.map((a) => a.member_id), { category: "community", title: `Có yêu cầu tham gia nhóm “${g.name.slice(0, 50)}”`, href: `/community/groups/${id}?tab=members` });
  }
  return status;
}

export async function leaveGroup(actor: Actor, id: string): Promise<void> {
  const m = await groupMembership(id, actor.id);
  if (!m) return;
  if (m.role === "owner" && m.status === "active") throw new ActionError("Chủ nhóm không thể rời nhóm.");
  await run("DELETE FROM com_group_members WHERE group_id = ? AND member_id = ? AND status != 'banned'", [id, actor.id]);
}

export async function decideJoin(actor: Actor, id: string, memberId: string, accept: boolean): Promise<void> {
  const g = await groupRow(id);
  if (!g) throw new ActionError("Không tìm thấy nhóm.");
  if (!groupCaps(await activeGroupRole(id, actor.id), g.visibility, false).admit) throw new ActionError("Chỉ chủ nhóm / điều hành viên duyệt thành viên.");
  const n = accept
    ? await run("UPDATE com_group_members SET status = 'active' WHERE group_id = ? AND member_id = ? AND status = 'requested'", [id, memberId])
    : await run("DELETE FROM com_group_members WHERE group_id = ? AND member_id = ? AND status = 'requested'", [id, memberId]);
  if (n !== 1) throw new ActionError("Yêu cầu không còn hiệu lực.");
  if (accept) await notify(memberId, { category: "community", title: `Bạn đã được nhận vào nhóm “${g.name.slice(0, 50)}”`, href: `/community/groups/${id}` });
}

/** Owner only: removes (and bans from re-joining) a member. Moderators and members cannot remove anyone. */
export async function removeFromGroup(actor: Actor, id: string, memberId: string): Promise<void> {
  const target = await groupMembership(id, memberId);
  if (!target || target.status !== "active") throw new ActionError("Người này không còn trong nhóm.");
  if (!canRemoveFromGroup(await activeGroupRole(id, actor.id), target.role)) {
    await audit(actor.id, "community.group.remove", `group:${id}/member:${memberId}`, "failure");
    throw new ActionError(target.role === "owner" ? "Không thể loại chủ nhóm." : "Chỉ chủ nhóm được loại thành viên.");
  }
  await run("UPDATE com_group_members SET status = 'banned', role = 'member' WHERE group_id = ? AND member_id = ?", [id, memberId]);
  await audit(actor.id, "community.group.remove", `group:${id}/member:${memberId}`, "success");
}

export async function setGroupRole(actor: Actor, id: string, memberId: string, role: "moderator" | "member"): Promise<void> {
  if ((await activeGroupRole(id, actor.id)) !== "owner") throw new ActionError("Chỉ chủ nhóm được đổi vai trò.");
  const n = await run("UPDATE com_group_members SET role = ? WHERE group_id = ? AND member_id = ? AND status = 'active' AND role != 'owner'", [role, id, memberId]);
  if (n !== 1) throw new ActionError("Không đổi được vai trò người này.");
}

/** Owner archives their group; platform moderators archive any group with a reason. */
export async function archiveGroup(actor: Actor, id: string, reason?: string): Promise<void> {
  const g = await groupRow(id);
  if (!g || g.status !== "active") throw new ActionError("Không tìm thấy nhóm.");
  const owner = g.owner_id === actor.id;
  if (!owner && !isMod(actor)) throw new ActionError("Bạn không có quyền lưu trữ nhóm này.");
  if (!owner && !reason?.trim()) throw new ActionError("Cần ghi lý do.");
  await run("UPDATE com_groups SET status = 'archived', archived_reason = ?, updated_at = ? WHERE id = ?", [reason?.trim() || null, now(), id]);
  await audit(actor.id, "community.group.archive", `group:${id}`, "success");
  if (!owner) await notify(g.owner_id, { category: "community", title: `Nhóm “${g.name.slice(0, 50)}” đã bị lưu trữ`, body: `Lý do: ${reason!.trim().slice(0, 200)}` });
}

// ───────────────────────── Posts ─────────────────────────

const postSchema = z.object({
  groupId: z.string().nullable().optional(),
  title: z.string().trim().max(150).default(""),
  body: z.string().trim().min(5, "Nội dung tối thiểu 5 ký tự.").max(10_000),
  topic: topicEnum.default("other"),
  images: z.array(z.string()).max(4, "Tối đa 4 ảnh.").default([]),
  poll: z.array(z.string()).optional(),
  allowComments: z.boolean().default(true),
  draft: z.boolean().default(false),
});

async function postGroupVisible(groupId: string | null, actor: Actor | null): Promise<boolean> {
  if (!groupId) return true;
  const g = await groupRow(groupId);
  if (!g || g.status !== "active") return false;
  return groupCaps(await activeGroupRole(groupId, actor?.id ?? null), g.visibility, false).viewContent;
}

/** COM-04 Create Post (mockup 76): in "Mọi người" or a group the author belongs to. 20 posts / hour. */
export async function createPost(actor: Actor, input: unknown): Promise<string> {
  await assertAllowed(actor.id, "community", "community");
  const d = postSchema.parse(input);
  if (!(await allowAttempt(`post:${actor.id}`, 20, 3600_000))) throw new ActionError("Bạn đăng quá nhanh. Thử lại sau ít phút.", "rate_limited");
  if (d.groupId) {
    const g = await groupRow(d.groupId);
    if (!g || g.status !== "active") throw new ActionError("Không tìm thấy nhóm.");
    if (!groupCaps(await activeGroupRole(d.groupId, actor.id), g.visibility, false).post) throw new ActionError("Hãy tham gia nhóm trước khi đăng bài.");
  }
  const poll = validatePoll(d.poll);
  if (typeof poll === "string") throw new ActionError(poll);
  const images = await verifyOwnUploadUrls(actor, "post", d.images, 4);
  const id = randomUUID();
  const t = now();
  await run(
    `INSERT INTO com_posts (id, author_id, group_id, title, body, topic, tags, images, allow_comments, status, created_at, updated_at, last_activity_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [id, actor.id, d.groupId ?? null, d.title, d.body, d.topic, JSON.stringify(extractTags(`${d.title} ${d.body}`)), JSON.stringify(images), d.allowComments ? 1 : 0, d.draft ? "draft" : "published", t, t, t],
  );
  for (const [i, label] of poll.entries()) {
    await run("INSERT INTO com_poll_options (id, post_id, label, position) VALUES (?, ?, ?, ?)", [randomUUID(), id, label, i]);
  }
  if (!d.draft) await awardPoints(actor.id, "post_create", id);
  return id;
}

export async function updatePost(actor: Actor, id: string, input: unknown): Promise<void> {
  const p = await one<{ author_id: string; status: PostStatus }>("SELECT author_id, status FROM com_posts WHERE id = ?", [id]);
  if (!p || p.status === "deleted") throw new ActionError("Không tìm thấy bài viết.");
  if (p.author_id !== actor.id) throw new ActionError("Bạn chỉ sửa được bài của mình.");
  if (p.status === "hidden") throw new ActionError("Bài đã bị ẩn bởi kiểm duyệt, không sửa được.");
  const d = postSchema.omit({ groupId: true, poll: true }).parse(input);
  const images = await verifyOwnUploadUrls(actor, "post", d.images, 4);
  await run("UPDATE com_posts SET title = ?, body = ?, topic = ?, tags = ?, images = ?, allow_comments = ?, status = ?, updated_at = ? WHERE id = ?", [
    d.title,
    d.body,
    d.topic,
    JSON.stringify(extractTags(`${d.title} ${d.body}`)),
    JSON.stringify(images),
    d.allowComments ? 1 : 0,
    d.draft ? "draft" : "published",
    now(),
    id,
  ]);
}

export async function deletePost(actor: Actor, id: string): Promise<void> {
  const p = await one<{ author_id: string; group_id: string | null }>("SELECT author_id, group_id FROM com_posts WHERE id = ?", [id]);
  if (!p) throw new ActionError("Không tìm thấy bài viết.");
  if (p.author_id !== actor.id) throw new ActionError("Bạn chỉ xóa được bài của mình. Người kiểm duyệt dùng “Ẩn bài”.");
  await run("UPDATE com_posts SET status = 'deleted', updated_at = ? WHERE id = ?", [now(), id]);
}

/** Moderation: platform moderators anywhere, group owner/moderators in their group. Always with a reason. */
export async function setPostHidden(actor: Actor, id: string, hidden: boolean, reason?: string): Promise<void> {
  const p = await one<{ author_id: string; group_id: string | null; title: string; body: string; status: PostStatus }>("SELECT author_id, group_id, title, body, status FROM com_posts WHERE id = ?", [id]);
  if (!p || p.status === "deleted" || p.status === "draft") throw new ActionError("Không tìm thấy bài viết.");
  const groupMod = p.group_id ? groupCaps(await activeGroupRole(p.group_id, actor.id), "public", false).moderate : false;
  if (!isMod(actor) && !groupMod) throw new ActionError("Bạn không có quyền kiểm duyệt bài này.");
  if (hidden && !reason?.trim()) throw new ActionError("Cần ghi lý do ẩn bài.");
  await run("UPDATE com_posts SET status = ?, hidden_reason = ?, updated_at = ? WHERE id = ?", [hidden ? "hidden" : "published", hidden ? reason!.trim().slice(0, 300) : null, now(), id]);
  await audit(actor.id, hidden ? "community.post.hide" : "community.post.unhide", `post:${id}`, "success");
  if (hidden) {
    await notify(p.author_id, { category: "community", title: "Bài viết của bạn đã bị ẩn", body: `“${(p.title || p.body).slice(0, 60)}” — Lý do: ${reason!.trim().slice(0, 200)}`, href: `/community/posts/${id}` });
  }
}

export type PostCard = {
  id: string;
  authorId: string;
  authorName: string;
  authorAvatar: string | null;
  groupId: string | null;
  groupName: string | null;
  title: string;
  body: string;
  topic: Topic;
  tags: string[];
  images: string[];
  status: PostStatus;
  hiddenReason: string | null;
  allowComments: boolean;
  likes: number;
  comments: number;
  liked: boolean;
  saved: boolean;
  createdAt: string;
};

/** Two leading "?" bind the viewer's id (liked / saved). Callers pass [viewerId, viewerId, ...]. */
const POST_SQL = `SELECT p.*, m.full_name AS author_name, m.avatar_url AS author_avatar, g.name AS group_name, g.visibility AS group_visibility,
  (SELECT COUNT(*) FROM com_reactions r WHERE r.post_id = p.id) AS likes,
  (SELECT COUNT(*) FROM com_comments c WHERE c.post_id = p.id AND c.status = 'visible') AS comments,
  EXISTS (SELECT 1 FROM com_reactions r WHERE r.post_id = p.id AND r.member_id = ?) AS liked,
  EXISTS (SELECT 1 FROM com_saved s WHERE s.post_id = p.id AND s.member_id = ?) AS saved
  FROM com_posts p JOIN members m ON m.id = p.author_id LEFT JOIN com_groups g ON g.id = p.group_id`;

type PostRow = {
  id: string;
  author_id: string;
  author_name: string;
  author_avatar: string | null;
  group_id: string | null;
  group_name: string | null;
  group_visibility: GroupVisibility | null;
  title: string;
  body: string;
  topic: Topic;
  tags: string;
  images: string;
  status: PostStatus;
  hidden_reason: string | null;
  allow_comments: number;
  likes: number;
  comments: number;
  liked: number;
  saved: number;
  created_at: string;
};
const toPost = (r: PostRow): PostCard => ({
  id: r.id,
  authorId: r.author_id,
  authorName: r.author_name,
  authorAvatar: r.author_avatar,
  groupId: r.group_id,
  groupName: r.group_name,
  title: r.title,
  body: r.body,
  topic: r.topic,
  tags: parseArr(r.tags),
  images: parseArr(r.images),
  status: r.status,
  hiddenReason: r.hidden_reason,
  allowComments: !!r.allow_comments,
  likes: Number(r.likes),
  comments: Number(r.comments),
  liked: !!r.liked,
  saved: !!r.saved,
  createdAt: r.created_at,
});

/**
 * COM-02 Feed / COM-16 Group feed. Visible = published, and either not in a group, in a public group,
 * or in a group the actor belongs to. Blocked authors are hidden.
 */
export async function feed(
  actor: Actor | null,
  f: { tab?: "latest" | "following" | "top" | "saved" | "mine"; topic?: string; groupId?: string; authorId?: string; tag?: string; q?: string; limit?: number } = {},
): Promise<PostCard[]> {
  const me = actor?.id ?? "";
  const where = [
    "p.status = 'published'",
    `(p.group_id IS NULL OR (g.status = 'active' AND (g.visibility = 'public' OR EXISTS (SELECT 1 FROM com_group_members gm WHERE gm.group_id = p.group_id AND gm.member_id = ? AND gm.status = 'active'))))`,
    "m.deleted_at IS NULL",
    "NOT EXISTS (SELECT 1 FROM com_blocks b WHERE b.blocker_id = ? AND b.blocked_id = p.author_id)",
  ];
  const args: (string | number)[] = [me, me];
  if (f.tab === "mine") {
    where.splice(0, 1, "p.status IN ('published','draft','hidden')");
    where.push("p.author_id = ?");
    args.push(me);
  }
  if (f.tab === "following" && actor) {
    where.push("(p.author_id IN (SELECT followee_id FROM com_follows WHERE follower_id = ?) OR p.group_id IN (SELECT group_id FROM com_group_members WHERE member_id = ? AND status = 'active'))");
    args.push(me, me);
  }
  if (f.tab === "saved" && actor) (where.push("p.id IN (SELECT post_id FROM com_saved WHERE member_id = ?)"), args.push(me));
  if (f.topic && f.topic in TOPICS) (where.push("p.topic = ?"), args.push(f.topic));
  if (f.groupId) (where.push("p.group_id = ?"), args.push(f.groupId));
  if (f.authorId) (where.push("p.author_id = ?"), args.push(f.authorId));
  if (f.tag) (where.push("EXISTS (SELECT 1 FROM json_each(p.tags) WHERE json_each.value = ?)"), args.push(f.tag.toLowerCase()));
  if (f.q?.trim()) (where.push("(p.title LIKE ? ESCAPE '\\' OR p.body LIKE ? ESCAPE '\\')"), args.push(like(f.q), like(f.q)));
  const order = f.tab === "top" ? "likes DESC, p.created_at DESC" : "p.last_activity_at DESC";
  if (f.tab === "top") (where.push("p.created_at >= ?"), args.push(new Date(Date.now() - 30 * 86_400_000).toISOString()));
  const rows = await all<PostRow>(`${POST_SQL} WHERE ${where.join(" AND ")} ORDER BY ${order} LIMIT ?`, [me, me, ...args, Math.min(f.limit ?? 30, 100)]);
  return rows.map(toPost);
}

export type PostDetail = PostCard & {
  canEdit: boolean;
  canModerate: boolean;
  poll: { options: { id: string; label: string; votes: number }[]; total: number; myVote: string | null } | null;
  commentList: { id: string; authorId: string; authorName: string; authorAvatar: string | null; body: string; createdAt: string; hidden: boolean; mine: boolean; parentId: string | null }[];
};

/** COM-03 Post Detail (mockup 75). */
export async function getPost(actor: Actor | null, id: string): Promise<PostDetail | null> {
  const me = actor?.id ?? "";
  const r = await one<PostRow>(`${POST_SQL} WHERE p.id = ?`, [me, me, id]);
  if (!r) return null;
  const groupMod = r.group_id && actor ? groupCaps(await activeGroupRole(r.group_id, actor.id), "public", false).moderate : false;
  const moderator = isMod(actor) || !!groupMod;
  if (!canReadPost({ status: r.status, authorId: r.author_id, groupVisible: await postGroupVisible(r.group_id, actor) }, actor?.id ?? null, moderator)) return null;
  const opts = await all<{ id: string; label: string; votes: number }>(
    "SELECT o.id, o.label, (SELECT COUNT(*) FROM com_poll_votes v WHERE v.option_id = o.id) AS votes FROM com_poll_options o WHERE o.post_id = ? ORDER BY o.position",
    [id],
  );
  const myVote = actor && opts.length ? ((await one<{ option_id: string }>("SELECT option_id FROM com_poll_votes WHERE post_id = ? AND member_id = ?", [id, actor.id]))?.option_id ?? null) : null;
  const comments = await all<{ id: string; author_id: string; full_name: string; avatar_url: string | null; body: string; created_at: string; status: string; parent_id: string | null }>(
    `SELECT c.id, c.author_id, m.full_name, m.avatar_url, c.body, c.created_at, c.status, c.parent_id FROM com_comments c JOIN members m ON m.id = c.author_id
     WHERE c.post_id = ? AND c.status != 'deleted' AND NOT EXISTS (SELECT 1 FROM com_blocks b WHERE b.blocker_id = ? AND b.blocked_id = c.author_id)
     ORDER BY c.created_at`,
    [id, me],
  );
  return {
    ...toPost(r),
    canEdit: r.author_id === me && r.status !== "hidden",
    canModerate: moderator,
    poll: opts.length ? { options: opts.map((o) => ({ ...o, votes: Number(o.votes) })), total: opts.reduce((s, o) => s + Number(o.votes), 0), myVote } : null,
    commentList: comments
      .filter((c) => c.status === "visible" || moderator || c.author_id === me)
      .map((c) => ({ id: c.id, authorId: c.author_id, authorName: c.full_name, authorAvatar: c.avatar_url, body: c.body, createdAt: c.created_at, hidden: c.status === "hidden", mine: c.author_id === me, parentId: c.parent_id })),
  };
}

async function requireReadable(actor: Actor, postId: string): Promise<PostRow> {
  const r = await one<PostRow>(`${POST_SQL} WHERE p.id = ?`, [actor.id, actor.id, postId]);
  if (!r || r.status !== "published" || !(await postGroupVisible(r.group_id, actor))) throw new ActionError("Không tìm thấy bài viết.");
  return r;
}

export async function toggleLike(actor: Actor, postId: string): Promise<boolean> {
  await requireReadable(actor, postId);
  if (await run("DELETE FROM com_reactions WHERE post_id = ? AND member_id = ?", [postId, actor.id])) return false;
  await run("INSERT INTO com_reactions (post_id, member_id, created_at) VALUES (?, ?, ?)", [postId, actor.id, now()]);
  return true;
}

export async function toggleSave(actor: Actor, postId: string): Promise<boolean> {
  await requireReadable(actor, postId);
  if (await run("DELETE FROM com_saved WHERE post_id = ? AND member_id = ?", [postId, actor.id])) return false;
  await run("INSERT INTO com_saved (post_id, member_id, created_at) VALUES (?, ?, ?)", [postId, actor.id, now()]);
  return true;
}

/** COM-07 poll: one vote per member, can change it. */
export async function vote(actor: Actor, postId: string, optionId: string): Promise<void> {
  await requireReadable(actor, postId);
  if (!(await one("SELECT 1 AS x FROM com_poll_options WHERE id = ? AND post_id = ?", [optionId, postId]))) throw new ActionError("Lựa chọn không hợp lệ.");
  await run(
    `INSERT INTO com_poll_votes (post_id, member_id, option_id, created_at) VALUES (?, ?, ?, ?)
     ON CONFLICT (post_id, member_id) DO UPDATE SET option_id = excluded.option_id, created_at = excluded.created_at`,
    [postId, actor.id, optionId, now()],
  );
}

/** COM-06 Comment. 30 comments / 10 minutes. */
export async function addComment(actor: Actor, postId: string, body: unknown, parentId?: string | null): Promise<string> {
  await assertAllowed(actor.id, "community", "community");
  const text = z.string().trim().min(1, "Nhập bình luận.").max(2000).parse(body);
  const p = await requireReadable(actor, postId);
  if (!p.allow_comments) throw new ActionError("Bài viết đã tắt bình luận.");
  if (await one("SELECT 1 AS x FROM com_blocks WHERE blocker_id = ? AND blocked_id = ?", [p.author_id, actor.id])) throw new ActionError("Bạn không thể bình luận bài này.");
  if (!(await allowAttempt(`comment:${actor.id}`, 30, 10 * 60_000))) throw new ActionError("Bạn bình luận quá nhanh.", "rate_limited");
  let parentAuthor: string | null = null;
  if (parentId) {
    const pc = await one<{ author_id: string }>("SELECT author_id FROM com_comments WHERE id = ? AND post_id = ? AND status = 'visible'", [parentId, postId]);
    if (!pc) throw new ActionError("Bình luận gốc không còn.");
    parentAuthor = pc.author_id;
  }
  const id = randomUUID();
  await run("INSERT INTO com_comments (id, post_id, author_id, parent_id, body, created_at) VALUES (?, ?, ?, ?, ?, ?)", [id, postId, actor.id, parentId ?? null, text, now()]);
  await run("UPDATE com_posts SET last_activity_at = ? WHERE id = ?", [now(), postId]);
  const who = (await one<{ full_name: string }>("SELECT full_name FROM members WHERE id = ?", [actor.id]))?.full_name ?? "Ai đó";
  const targets = [p.author_id, parentAuthor].filter((x): x is string => !!x && x !== actor.id);
  await notify(targets, { category: "community", title: `${who} đã bình luận về bài viết${parentAuthor && parentAuthor !== p.author_id ? " bạn tham gia" : " của bạn"}`, body: text.slice(0, 120), href: `/community/posts/${postId}` });
  return id;
}

export async function deleteComment(actor: Actor, commentId: string): Promise<void> {
  const c = await one<{ author_id: string }>("SELECT author_id FROM com_comments WHERE id = ?", [commentId]);
  if (!c) throw new ActionError("Không tìm thấy bình luận.");
  if (c.author_id !== actor.id) throw new ActionError("Bạn chỉ xóa được bình luận của mình.");
  await run("UPDATE com_comments SET status = 'deleted' WHERE id = ?", [commentId]);
}

export async function setCommentHidden(actor: Actor, commentId: string, hidden: boolean): Promise<void> {
  const c = await one<{ post_id: string; group_id: string | null }>("SELECT c.post_id, p.group_id FROM com_comments c JOIN com_posts p ON p.id = c.post_id WHERE c.id = ?", [commentId]);
  if (!c) throw new ActionError("Không tìm thấy bình luận.");
  const groupMod = c.group_id ? groupCaps(await activeGroupRole(c.group_id, actor.id), "public", false).moderate : false;
  if (!isMod(actor) && !groupMod) throw new ActionError("Bạn không có quyền kiểm duyệt.");
  await run("UPDATE com_comments SET status = ? WHERE id = ? AND status != 'deleted'", [hidden ? "hidden" : "visible", commentId]);
  await audit(actor.id, hidden ? "community.comment.hide" : "community.comment.unhide", `comment:${commentId}`, "success");
}

// ───────────────────────── Follows, blocks, profiles ─────────────────────────

export async function toggleFollow(actor: Actor, memberId: string): Promise<boolean> {
  if (memberId === actor.id) throw new ActionError("Không thể tự theo dõi.");
  const target = await one<{ id: string }>("SELECT id FROM members WHERE id = ? AND deleted_at IS NULL AND locked = 0", [memberId]);
  if (!target) throw new ActionError("Không tìm thấy thành viên.");
  if (await run("DELETE FROM com_follows WHERE follower_id = ? AND followee_id = ?", [actor.id, memberId])) return false;
  if (await one("SELECT 1 AS x FROM com_blocks WHERE blocker_id = ? AND blocked_id = ?", [memberId, actor.id])) throw new ActionError("Không thể theo dõi thành viên này.");
  await run("INSERT INTO com_follows (follower_id, followee_id, created_at) VALUES (?, ?, ?)", [actor.id, memberId, now()]);
  const who = (await one<{ full_name: string }>("SELECT full_name FROM members WHERE id = ?", [actor.id]))?.full_name ?? "Ai đó";
  await notify(memberId, { category: "community", title: `${who} đã theo dõi bạn`, href: `/members/${actor.id}`, dedupeKey: `follow:${actor.id}` });
  return true;
}

/** Blocking stops messages, comments on your posts and following; their posts disappear from your feed. */
export async function toggleBlock(actor: Actor, memberId: string): Promise<boolean> {
  if (memberId === actor.id) throw new ActionError("Không thể tự chặn.");
  if (await run("DELETE FROM com_blocks WHERE blocker_id = ? AND blocked_id = ?", [actor.id, memberId])) return false;
  await run("INSERT INTO com_blocks (blocker_id, blocked_id, created_at) VALUES (?, ?, ?)", [actor.id, memberId, now()]);
  await run("DELETE FROM com_follows WHERE (follower_id = ? AND followee_id = ?) OR (follower_id = ? AND followee_id = ?)", [actor.id, memberId, memberId, actor.id]);
  return true;
}

export async function socialStats(actor: Actor | null, memberId: string): Promise<{ posts: number; followers: number; following: number; isFollowing: boolean; blocked: boolean }> {
  const r = await one<{ posts: number; followers: number; following: number }>(
    `SELECT (SELECT COUNT(*) FROM com_posts WHERE author_id = ? AND status = 'published' AND group_id IS NULL) AS posts,
            (SELECT COUNT(*) FROM com_follows WHERE followee_id = ?) AS followers,
            (SELECT COUNT(*) FROM com_follows WHERE follower_id = ?) AS following`,
    [memberId, memberId, memberId],
  );
  const isFollowing = actor ? !!(await one("SELECT 1 AS x FROM com_follows WHERE follower_id = ? AND followee_id = ?", [actor.id, memberId])) : false;
  const blocked = actor ? !!(await one("SELECT 1 AS x FROM com_blocks WHERE blocker_id = ? AND blocked_id = ?", [actor.id, memberId])) : false;
  return { posts: Number(r?.posts ?? 0), followers: Number(r?.followers ?? 0), following: Number(r?.following ?? 0), isFollowing, blocked };
}

/** COM-09 Member Directory: members who allow being listed. */
export async function memberDirectory(actor: Actor, q = ""): Promise<{ id: string; name: string; avatarUrl: string | null; bio: string; followers: number; isFollowing: boolean }[]> {
  const rows = await all<{ id: string; name: string; avatarUrl: string | null; bio: string; followers: number; isFollowing: number }>(
    `SELECT m.id, m.full_name AS name, m.avatar_url AS avatarUrl, m.bio,
       (SELECT COUNT(*) FROM com_follows f WHERE f.followee_id = m.id) AS followers,
       EXISTS (SELECT 1 FROM com_follows f WHERE f.follower_id = ? AND f.followee_id = m.id) AS isFollowing
     FROM members m WHERE m.deleted_at IS NULL AND m.locked = 0 AND m.id != ?
       AND COALESCE(json_extract(m.privacy, '$.profileVisibility'), 'members') = 'members'
       ${q.trim() ? "AND m.full_name LIKE ? ESCAPE '\\'" : ""}
     ORDER BY followers DESC, m.full_name LIMIT 60`,
    q.trim() ? [actor.id, actor.id, like(q)] : [actor.id, actor.id],
  );
  return rows.map((r) => ({ ...r, followers: Number(r.followers), isFollowing: !!r.isFollowing }));
}

// ───────────────────────── Reports & moderation queue (COM-A05/A06) ─────────────────────────

export async function report(actor: Actor, input: unknown): Promise<void> {
  const d = z
    .object({
      targetType: z.enum(["post", "comment", "group", "member", "message"]),
      targetId: z.string().min(1).max(64),
      reason: z.enum(Object.keys(REPORT_REASONS) as [ReportReason, ...ReportReason[]]),
      details: z.string().trim().max(1000).default(""),
    })
    .parse(input);
  if (!(await allowAttempt(`report:${actor.id}`, 20, 3600_000))) throw new ActionError("Bạn đã gửi quá nhiều báo cáo.", "rate_limited");
  await run(
    `INSERT INTO com_reports (id, reporter_id, target_type, target_id, reason, details, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)
     ON CONFLICT (reporter_id, target_type, target_id) DO UPDATE SET reason = excluded.reason, details = excluded.details, status = 'open', created_at = excluded.created_at`,
    [randomUUID(), actor.id, d.targetType, d.targetId, d.reason, d.details, now()],
  );
}

export type ReportItem = { id: string; targetType: ReportTarget; targetId: string; reason: ReportReason; details: string; reporterName: string; createdAt: string; preview: string; href: string | null; count: number };

export async function reportQueue(actor: Actor): Promise<ReportItem[]> {
  if (!isMod(actor)) throw new ActionError("Bạn không có quyền xem báo cáo vi phạm.");
  const rows = await all<{ id: string; target_type: ReportTarget; target_id: string; reason: ReportReason; details: string; full_name: string; created_at: string; n: number }>(
    `SELECT r.*, m.full_name, (SELECT COUNT(*) FROM com_reports x WHERE x.target_type = r.target_type AND x.target_id = r.target_id AND x.status = 'open') AS n
     FROM com_reports r JOIN members m ON m.id = r.reporter_id WHERE r.status = 'open' ORDER BY r.created_at LIMIT 100`,
  );
  const out: ReportItem[] = [];
  for (const r of rows) {
    let preview = "";
    let href: string | null = null;
    if (r.target_type === "post") {
      const p = await one<{ title: string; body: string }>("SELECT title, body FROM com_posts WHERE id = ?", [r.target_id]);
      preview = (p?.title || p?.body || "(đã xóa)").slice(0, 140);
      href = `/community/posts/${r.target_id}`;
    } else if (r.target_type === "comment") {
      const c = await one<{ body: string; post_id: string }>("SELECT body, post_id FROM com_comments WHERE id = ?", [r.target_id]);
      preview = (c?.body ?? "(đã xóa)").slice(0, 140);
      href = c ? `/community/posts/${c.post_id}` : null;
    } else if (r.target_type === "group") {
      preview = (await one<{ name: string }>("SELECT name FROM com_groups WHERE id = ?", [r.target_id]))?.name ?? "(đã xóa)";
      href = `/community/groups/${r.target_id}`;
    } else if (r.target_type === "member") {
      preview = (await one<{ full_name: string }>("SELECT full_name FROM members WHERE id = ?", [r.target_id]))?.full_name ?? "";
      href = `/members/${r.target_id}`;
    } else {
      // Message content is private: moderators see it only when it was reported.
      preview = ((await one<{ body: string }>("SELECT body FROM dm_messages WHERE id = ?", [r.target_id]))?.body ?? "(đã xóa)").slice(0, 140);
    }
    out.push({ id: r.id, targetType: r.target_type, targetId: r.target_id, reason: r.reason, details: r.details, reporterName: r.full_name, createdAt: r.created_at, preview, href, count: Number(r.n) });
  }
  return out;
}

/** Decide a report: "hide" hides the post/comment (or archives the group); "dismiss" keeps it. Closes every open report on that target. */
export async function decideReport(actor: Actor, reportId: string, decision: "hide" | "dismiss", note?: string): Promise<void> {
  if (!isMod(actor)) throw new ActionError("Bạn không có quyền xử lý báo cáo.");
  const r = await one<{ target_type: ReportTarget; target_id: string; reason: ReportReason }>("SELECT target_type, target_id, reason FROM com_reports WHERE id = ? AND status = 'open'", [reportId]);
  if (!r) throw new ActionError("Báo cáo đã được xử lý.");
  const why = note?.trim() || REPORT_REASONS[r.reason];
  if (decision === "hide") {
    if (r.target_type === "post") await setPostHidden(actor, r.target_id, true, why);
    else if (r.target_type === "comment") await setCommentHidden(actor, r.target_id, true);
    else if (r.target_type === "group") await archiveGroup(actor, r.target_id, why);
    else if (r.target_type === "message") await run("UPDATE dm_messages SET deleted_at = ? WHERE id = ?", [now(), r.target_id]);
  }
  const reporters = await all<{ reporter_id: string }>("SELECT reporter_id FROM com_reports WHERE target_type = ? AND target_id = ? AND status = 'open'", [r.target_type, r.target_id]);
  await run("UPDATE com_reports SET status = ?, decided_by = ?, decision_note = ?, decided_at = ? WHERE target_type = ? AND target_id = ? AND status = 'open'", [
    decision === "hide" ? "actioned" : "dismissed",
    actor.id,
    note?.trim() || null,
    now(),
    r.target_type,
    r.target_id,
  ]);
  await audit(actor.id, `community.report.${decision}`, `${r.target_type}:${r.target_id}`, "success");
  await notify(reporters.map((x) => x.reporter_id), {
    category: "community",
    title: decision === "hide" ? "Báo cáo của bạn đã được xử lý: nội dung đã bị ẩn" : "Báo cáo của bạn đã được xem xét",
    body: decision === "dismiss" ? "Nội dung chưa vi phạm quy định cộng đồng." : "",
  });
}

export async function communityStats(): Promise<{ posts: number; groups: number; members: number }> {
  const r = await one<{ posts: number; groups: number; members: number }>(
    `SELECT (SELECT COUNT(*) FROM com_posts WHERE status = 'published') AS posts, (SELECT COUNT(*) FROM com_groups WHERE status = 'active') AS groups,
            (SELECT COUNT(*) FROM members WHERE deleted_at IS NULL AND locked = 0) AS members`,
  );
  return { posts: Number(r?.posts ?? 0), groups: Number(r?.groups ?? 0), members: Number(r?.members ?? 0) };
}

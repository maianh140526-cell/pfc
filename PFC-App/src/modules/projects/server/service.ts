import "server-only";
import { notify } from "@/platform/notifications/service";
import { randomUUID } from "node:crypto";
import { z } from "zod";
import { all, one, run } from "@/platform/db/client";
import { audit } from "@/platform/audit";
import { ActionError } from "@/platform/errors";
import { can, type Actor } from "@/platform/roles";
import {
  LINK_KINDS,
  PROJECT_CATEGORIES,
  TASK_STATUSES,
  allowedTaskStatus,
  applyProjectAction,
  availableProjectActions,
  canEditProject,
  canEditTask,
  canInviteAs,
  canRemoveMember,
  isProjectStatus,
  isPublicStatus,
  parseSkills,
  projectCaps,
  projectProgress,
  safeHttpsUrl,
  type LinkKind,
  type MemberRole,
  type MemberStatus,
  type ProjectAction,
  type ProjectCaps,
  type ProjectCategory,
  type ProjectStatus,
  type TaskStatus,
} from "../domain/projects";

/** Project Marketplace use-cases. Actor-based; every permission is checked here, never only in the UI. */
const now = () => new Date().toISOString();
const today = () => now().slice(0, 10);
const likeArg = (q: string) => `%${q.trim().replace(/[\\%_]/g, (m) => `\\${m}`)}%`;
const manageAny = (a: Actor) => ({ manageAny: can(a, "project.manage_any") });

type Row = {
  id: string;
  owner_id: string;
  title: string;
  summary: string;
  description: string;
  category: ProjectCategory;
  skills: string;
  recruiting: number;
  status: string;
  reject_reason: string | null;
  created_at: string;
  updated_at: string;
  published_at: string | null;
};

async function projectRow(id: string): Promise<Row | null> {
  return one<Row>("SELECT * FROM prj_projects WHERE id = ?", [id]);
}
async function requireProject(id: string): Promise<Row & { status: ProjectStatus }> {
  const p = await projectRow(id);
  if (!p || !isProjectStatus(p.status)) throw new ActionError("Không tìm thấy dự án.");
  return p as Row & { status: ProjectStatus };
}

/** Owner + leads of a project (who handle join requests). */
async function admins(projectId: string): Promise<string[]> {
  return (await all<{ member_id: string }>("SELECT member_id FROM prj_members WHERE project_id = ? AND status = 'active' AND role IN ('owner','lead')", [projectId])).map((r) => r.member_id);
}

async function membership(projectId: string, memberId: string): Promise<{ role: MemberRole; status: MemberStatus } | null> {
  return one<{ role: MemberRole; status: MemberStatus }>("SELECT role, status FROM prj_members WHERE project_id = ? AND member_id = ?", [projectId, memberId]);
}
async function activeRole(projectId: string, memberId: string): Promise<MemberRole | null> {
  const m = await membership(projectId, memberId);
  return m?.status === "active" ? m.role : null;
}

function who(actor: Actor, p: Row) {
  return { isOwner: p.owner_id === actor.id, canApprove: can(actor, "project.approve"), canArchiveAny: can(actor, "project.archive_any") };
}

/** Can this actor see the project at all? Public statuses for everyone; otherwise team, approvers, Chủ nhiệm. */
async function canSee(actor: Actor, p: Row & { status: ProjectStatus }): Promise<boolean> {
  if (isPublicStatus(p.status)) return true;
  if (p.owner_id === actor.id || can(actor, "project.approve") || can(actor, "project.manage_any")) return true;
  return (await activeRole(p.id, actor.id)) !== null;
}

// ───────────────────────── Projects ─────────────────────────

const projectSchema = z.object({
  title: z.string().trim().min(5, "Tên dự án tối thiểu 5 ký tự.").max(120),
  summary: z.string().trim().min(10, "Mô tả ngắn tối thiểu 10 ký tự.").max(200),
  description: z.string().trim().max(8000).default(""),
  category: z.enum(Object.keys(PROJECT_CATEGORIES) as [ProjectCategory, ...ProjectCategory[]], { message: "Chọn lĩnh vực." }),
  skills: z.string().max(400).default(""),
  recruiting: z.boolean().default(true),
});

export type ProjectCard = {
  id: string;
  title: string;
  summary: string;
  category: ProjectCategory;
  skills: string[];
  recruiting: boolean;
  status: ProjectStatus;
  ownerName: string;
  memberCount: number;
  rating: number | null;
  ratingCount: number;
  updatedAt: string;
};

const CARD_SQL = `SELECT p.*, m.full_name AS owner_name,
    (SELECT COUNT(*) FROM prj_members pm WHERE pm.project_id = p.id AND pm.status = 'active') AS member_count,
    (SELECT AVG(rating) FROM prj_feedback f WHERE f.project_id = p.id AND f.hidden = 0) AS rating,
    (SELECT COUNT(*) FROM prj_feedback f WHERE f.project_id = p.id AND f.hidden = 0) AS rating_count
  FROM prj_projects p JOIN members m ON m.id = p.owner_id`;
type CardRow = Row & { owner_name: string; member_count: number; rating: number | null; rating_count: number };
const toCard = (r: CardRow): ProjectCard => ({
  id: r.id,
  title: r.title,
  summary: r.summary,
  category: r.category,
  skills: parseSkills(r.skills),
  recruiting: !!r.recruiting,
  status: isProjectStatus(r.status) ? r.status : "draft",
  ownerName: r.owner_name,
  memberCount: Number(r.member_count),
  rating: r.rating === null ? null : Math.round(Number(r.rating) * 10) / 10,
  ratingCount: Number(r.rating_count),
  updatedAt: r.updated_at,
});

/** PRO-02/03 Project list with search / filter. Only active + completed projects are listed. */
export async function listProjects(filter: { q?: string; category?: string; recruiting?: boolean; status?: "active" | "completed" } = {}): Promise<ProjectCard[]> {
  const where = [filter.status ? "p.status = ?" : "p.status IN ('active','completed')"];
  const args: (string | number)[] = filter.status ? [filter.status] : [];
  if (filter.q?.trim()) {
    where.push("(p.title LIKE ? ESCAPE '\\' OR p.summary LIKE ? ESCAPE '\\' OR p.skills LIKE ? ESCAPE '\\')");
    args.push(likeArg(filter.q), likeArg(filter.q), likeArg(filter.q));
  }
  if (filter.category && filter.category in PROJECT_CATEGORIES) {
    where.push("p.category = ?");
    args.push(filter.category);
  }
  if (filter.recruiting) where.push("p.recruiting = 1 AND p.status = 'active'");
  const rows = await all<CardRow>(`${CARD_SQL} WHERE ${where.join(" AND ")} ORDER BY p.status = 'active' DESC, p.updated_at DESC LIMIT 100`, args);
  return rows.map(toCard);
}

export async function createProject(actor: Actor, input: unknown): Promise<string> {
  const d = projectSchema.parse(input);
  const id = randomUUID();
  const t = now();
  await run(
    "INSERT INTO prj_projects (id, owner_id, title, summary, description, category, skills, recruiting, status, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'draft', ?, ?)",
    [id, actor.id, d.title, d.summary, d.description, d.category, parseSkills(d.skills).join(", "), d.recruiting ? 1 : 0, t, t],
  );
  await run("INSERT INTO prj_members (project_id, member_id, role, status, created_at, updated_at) VALUES (?, ?, 'owner', 'active', ?, ?)", [id, actor.id, t, t]);
  await audit(actor.id, "project.create", `project:${id}`, "success");
  return id;
}

export async function updateProject(actor: Actor, id: string, input: unknown): Promise<void> {
  const p = await requireProject(id);
  if (!canEditProject(p.status, who(actor, p))) throw new ActionError(p.status === "submitted" ? "Dự án đang chờ duyệt, chưa sửa được." : "Bạn không có quyền sửa dự án này.");
  const d = projectSchema.parse(input);
  await run("UPDATE prj_projects SET title = ?, summary = ?, description = ?, category = ?, skills = ?, recruiting = ?, updated_at = ? WHERE id = ?", [
    d.title,
    d.summary,
    d.description,
    d.category,
    parseSkills(d.skills).join(", "),
    d.recruiting ? 1 : 0,
    now(),
    id,
  ]);
}

export async function projectTransition(actor: Actor, id: string, action: ProjectAction, reason?: string): Promise<ProjectStatus> {
  const p = await requireProject(id);
  const r = applyProjectAction(action, p.status, who(actor, p), reason);
  if (!r.ok) throw new ActionError(r.error);
  const res = await run(
    `UPDATE prj_projects SET status = ?, reject_reason = ?, updated_at = ?, published_at = CASE WHEN ? = 'active' AND published_at IS NULL THEN ? ELSE published_at END WHERE id = ? AND status = ?`,
    [r.to, r.to === "rejected" ? reason!.trim() : null, now(), r.to, now(), id, p.status],
  );
  if (res !== 1) throw new ActionError("Dự án vừa được người khác cập nhật. Tải lại trang.");
  await audit(actor.id, `project.${action}`, `project:${id}`, "success");
  if (p.owner_id !== actor.id && (r.to === "active" || r.to === "rejected" || r.to === "archived")) {
    const verb = r.to === "active" ? (action === "restore" ? "đã được khôi phục" : "đã được duyệt và công khai") : r.to === "rejected" ? "bị từ chối" : "đã bị lưu trữ";
    await notify(p.owner_id, { category: "projects", title: `Dự án “${p.title.slice(0, 60)}” ${verb}`, body: r.to === "rejected" ? `Lý do: ${reason!.trim().slice(0, 200)}` : "", href: `/projects/p/${id}` });
  }
  return r.to;
}

/** Only never-published drafts / rejected projects can be deleted, by their owner. */
export async function deleteProject(actor: Actor, id: string): Promise<void> {
  const p = await requireProject(id);
  if (p.owner_id !== actor.id) throw new ActionError("Chỉ chủ dự án được xóa.");
  if ((p.status !== "draft" && p.status !== "rejected") || p.published_at) throw new ActionError("Dự án đã công khai không xóa được, hãy lưu trữ.");
  await run("DELETE FROM prj_projects WHERE id = ?", [id]);
  await audit(actor.id, "project.delete", `project:${id}`, "success");
}

export type TeamMember = { memberId: string; name: string; email: string; role: MemberRole; status: MemberStatus; message: string; scope: string; since: string };

export type ProjectDetail = ProjectCard & {
  description: string;
  ownerId: string;
  rejectReason: string | null;
  myRole: MemberRole | null;
  myStatus: MemberStatus | null;
  caps: ProjectCaps;
  canEdit: boolean;
  canDelete: boolean;
  actions: ProjectAction[];
  team: TeamMember[];
  pending: TeamMember[];
  links: { id: string; kind: LinkKind; title: string; url: string; visibility: "public" | "team" }[];
  feedback: { id: string; authorName: string; rating: number; comment: string; hidden: boolean; createdAt: string; mine: boolean }[];
  myFeedback: { rating: number; comment: string } | null;
  progress: { done: number; total: number; percent: number } | null;
  canModerateFeedback: boolean;
};

/** PRO-04 Project Detail. Returns null when the actor may not see the project. Records one view per member per day. */
export async function getProject(actor: Actor, id: string): Promise<ProjectDetail | null> {
  const p = await projectRow(id);
  if (!p || !isProjectStatus(p.status)) return null;
  const pp = p as Row & { status: ProjectStatus };
  if (!(await canSee(actor, pp))) return null;
  const card = toCard((await one<CardRow>(`${CARD_SQL} WHERE p.id = ?`, [id]))!);
  const mine = await membership(id, actor.id);
  const myRole = mine?.status === "active" ? mine.role : null;
  const staff = manageAny(actor);
  const caps = projectCaps(myRole, staff);
  const w = who(actor, p);
  const canModerateFeedback = can(actor, "project.approve") || staff.manageAny;

  const members = await all<{ member_id: string; full_name: string; email: string; role: MemberRole; status: MemberStatus; message: string; scope: string; updated_at: string }>(
    `SELECT pm.*, m.full_name, m.email FROM prj_members pm JOIN members m ON m.id = pm.member_id
     WHERE pm.project_id = ? AND pm.status IN ('active','requested','invited')
     ORDER BY CASE pm.role WHEN 'owner' THEN 0 WHEN 'lead' THEN 1 WHEN 'mentor' THEN 2 ELSE 3 END, pm.created_at`,
    [id],
  );
  const toTeam = (r: (typeof members)[number]): TeamMember => ({
    memberId: r.member_id,
    name: r.full_name,
    // Emails are visible to the team only.
    email: caps.viewWorkspace ? r.email : "",
    role: r.role,
    status: r.status,
    message: r.message,
    scope: r.scope,
    since: r.updated_at,
  });

  const links = (await all<{ id: string; kind: LinkKind; title: string; url: string; visibility: "public" | "team" }>(
    "SELECT id, kind, title, url, visibility FROM prj_links WHERE project_id = ? ORDER BY created_at",
    [id],
  )).filter((l) => l.visibility === "public" || caps.viewWorkspace);

  const fb = await all<{ id: string; author_id: string; full_name: string; rating: number; comment: string; hidden: number; created_at: string }>(
    "SELECT f.*, m.full_name FROM prj_feedback f JOIN members m ON m.id = f.author_id WHERE f.project_id = ? ORDER BY f.created_at DESC",
    [id],
  );
  const feedback = fb
    .filter((f) => !f.hidden || canModerateFeedback || f.author_id === actor.id)
    .map((f) => ({ id: f.id, authorName: f.full_name, rating: f.rating, comment: f.comment, hidden: !!f.hidden, createdAt: f.created_at, mine: f.author_id === actor.id }));
  const my = fb.find((f) => f.author_id === actor.id);

  let progress: ProjectDetail["progress"] = null;
  if (caps.viewWorkspace) progress = projectProgress(await all<{ status: TaskStatus }>("SELECT status FROM prj_tasks WHERE project_id = ?", [id]));

  if (!myRole && isPublicStatus(pp.status)) {
    await run("INSERT INTO prj_views (project_id, member_id, day) VALUES (?, ?, ?) ON CONFLICT DO NOTHING", [id, actor.id, today()]);
  }

  return {
    ...card,
    description: p.description,
    ownerId: p.owner_id,
    rejectReason: p.reject_reason,
    myRole,
    myStatus: mine?.status ?? null,
    caps,
    canEdit: canEditProject(pp.status, w),
    canDelete: p.owner_id === actor.id && (pp.status === "draft" || pp.status === "rejected") && !p.published_at,
    actions: availableProjectActions(pp.status, w),
    team: members.filter((m) => m.status === "active").map(toTeam),
    pending: caps.admitMembers ? members.filter((m) => m.status !== "active").map(toTeam) : [],
    links,
    feedback,
    myFeedback: my ? { rating: my.rating, comment: my.comment } : null,
    progress,
    canModerateFeedback,
  };
}

export type MyProject = ProjectCard & { myRole: MemberRole; myStatus: MemberStatus };

/** PRO-22 My Projects: active memberships, pending invitations and my join requests. */
export async function myProjects(actor: Actor): Promise<MyProject[]> {
  const rows = await all<CardRow & { my_role: MemberRole; my_status: MemberStatus }>(
    `${CARD_SQL.replace("SELECT p.*,", "SELECT p.*, me.role AS my_role, me.status AS my_status,")} JOIN prj_members me ON me.project_id = p.id AND me.member_id = ?
     WHERE me.status IN ('active','invited','requested') ORDER BY me.status = 'invited' DESC, p.updated_at DESC`,
    [actor.id],
  );
  return rows.map((r) => ({ ...toCard(r), myRole: r.my_role, myStatus: r.my_status }));
}

/** PRO-26 Project Approval queue for `project.approve`. */
export async function approvalQueue(actor: Actor): Promise<ProjectCard[]> {
  if (!can(actor, "project.approve")) throw new ActionError("Bạn không có quyền duyệt dự án.");
  return (await all<CardRow>(`${CARD_SQL} WHERE p.status = 'submitted' ORDER BY p.updated_at`)).map(toCard);
}

// ───────────────────────── Membership ─────────────────────────

const requestSchema = z.object({
  role: z.enum(["member", "mentor"]),
  message: z.string().trim().min(10, "Giới thiệu ngắn về bạn (tối thiểu 10 ký tự).").max(500),
});

/** PRO-12/13 Collaboration request / Project application (join as member, or offer to mentor). */
export async function requestToJoin(actor: Actor, projectId: string, input: unknown): Promise<void> {
  const d = requestSchema.parse(input);
  const p = await requireProject(projectId);
  if (p.status !== "active") throw new ActionError("Dự án không nhận thành viên ở trạng thái này.");
  if (d.role === "member" && !p.recruiting) throw new ActionError("Dự án đang không tuyển thành viên.");
  const m = await membership(projectId, actor.id);
  if (m?.status === "active") throw new ActionError("Bạn đã ở trong dự án.");
  if (m?.status === "requested") throw new ActionError("Bạn đã gửi yêu cầu, hãy chờ phản hồi.");
  if (m?.status === "invited") throw new ActionError("Bạn đã được mời: hãy chấp nhận lời mời.");
  if (m?.status === "removed") throw new ActionError("Bạn đã bị loại khỏi dự án này, không thể tự xin lại.");
  const t = now();
  await run(
    `INSERT INTO prj_members (project_id, member_id, role, status, message, created_at, updated_at) VALUES (?, ?, ?, 'requested', ?, ?, ?)
     ON CONFLICT (project_id, member_id) DO UPDATE SET role = excluded.role, status = 'requested', message = excluded.message, updated_at = excluded.updated_at`,
    [projectId, actor.id, d.role, d.message, t, t],
  );
  await notify(await admins(projectId), { category: "projects", title: d.role === "mentor" ? "Có người đề nghị làm mentor" : "Có yêu cầu tham gia dự án", body: p.title.slice(0, 120), href: `/projects/p/${projectId}/workspace?tab=team` });
}

export async function cancelRequest(actor: Actor, projectId: string): Promise<void> {
  await run("DELETE FROM prj_members WHERE project_id = ? AND member_id = ? AND status = 'requested'", [projectId, actor.id]);
}

/** Owner / lead (or Chủ nhiệm) accept or decline a join request. */
export async function decideRequest(actor: Actor, projectId: string, memberId: string, accept: boolean): Promise<void> {
  const p = await requireProject(projectId);
  const caps = projectCaps(await activeRole(projectId, actor.id), manageAny(actor));
  if (!caps.admitMembers) throw new ActionError("Bạn không có quyền duyệt thành viên.");
  if (p.status !== "active" && accept) throw new ActionError("Dự án không ở trạng thái hoạt động.");
  const m = await membership(projectId, memberId);
  if (m?.status !== "requested") throw new ActionError("Yêu cầu không còn hiệu lực.");
  if (accept && !canInviteAs(await activeRole(projectId, actor.id), m.role, manageAny(actor))) throw new ActionError("Chỉ chủ dự án được nhận mentor.");
  await run("UPDATE prj_members SET status = ?, updated_at = ? WHERE project_id = ? AND member_id = ? AND status = 'requested'", [
    accept ? "active" : "declined",
    now(),
    projectId,
    memberId,
  ]);
  await audit(actor.id, accept ? "project.member.accept" : "project.member.decline", `project:${projectId}/member:${memberId}`, "success");
  await notify(memberId, { category: "projects", title: accept ? `Bạn đã được nhận vào dự án “${p.title.slice(0, 60)}”` : `Yêu cầu tham gia “${p.title.slice(0, 60)}” chưa được nhận`, href: `/projects/p/${projectId}` });
}

const inviteSchema = z.object({
  email: z.string().trim().toLowerCase().email("Email không hợp lệ."),
  role: z.enum(["lead", "member", "mentor"]),
  scope: z.string().trim().max(300).default(""),
});

/** PRO-08/24/25 Invite a collaborator or mentor by their PFC account email. */
export async function inviteMember(actor: Actor, projectId: string, input: unknown): Promise<void> {
  const d = inviteSchema.parse(input);
  const p = await requireProject(projectId);
  if (p.status !== "active" && p.status !== "draft") throw new ActionError("Không mời được thành viên ở trạng thái này.");
  const myRole = await activeRole(projectId, actor.id);
  if (!canInviteAs(myRole, d.role, manageAny(actor))) throw new ActionError(myRole === "lead" ? "Trưởng nhóm chỉ mời được thành viên." : "Bạn không có quyền mời.");
  // Privacy setting (mockup 272) "Cho phép tìm thấy qua email": opted-out members cannot be found this way.
  const target = await one<{ id: string }>(
    "SELECT id FROM members WHERE email = ? AND locked = 0 AND deleted_at IS NULL AND COALESCE(json_extract(privacy, '$.findByEmail'), 1) = 1",
    [d.email],
  );
  if (!target) throw new ActionError("Không có tài khoản PFC với email này.");
  const m = await membership(projectId, target.id);
  if (m?.status === "active") throw new ActionError("Người này đã ở trong dự án.");
  const t = now();
  await run(
    `INSERT INTO prj_members (project_id, member_id, role, status, scope, invited_by, created_at, updated_at) VALUES (?, ?, ?, 'invited', ?, ?, ?, ?)
     ON CONFLICT (project_id, member_id) DO UPDATE SET role = excluded.role, status = 'invited', scope = excluded.scope, invited_by = excluded.invited_by, updated_at = excluded.updated_at`,
    [projectId, target.id, d.role, d.scope, actor.id, t, t],
  );
  await audit(actor.id, "project.member.invite", `project:${projectId}/member:${target.id}`, "success");
  await notify(target.id, { category: "projects", title: `Bạn được mời tham gia dự án “${p.title.slice(0, 60)}”`, href: `/projects/p/${projectId}` });
}

export async function respondInvite(actor: Actor, projectId: string, accept: boolean): Promise<void> {
  const m = await membership(projectId, actor.id);
  if (m?.status !== "invited") throw new ActionError("Lời mời không còn hiệu lực.");
  await run("UPDATE prj_members SET status = ?, updated_at = ? WHERE project_id = ? AND member_id = ?", [accept ? "active" : "declined", now(), projectId, actor.id]);
}

/** Remove (kick) a member: owner or Chủ nhiệm only, never the owner. Members, leads and mentors cannot remove anyone. */
export async function removeMember(actor: Actor, projectId: string, memberId: string): Promise<void> {
  await requireProject(projectId);
  const target = await membership(projectId, memberId);
  if (!target || (target.status !== "active" && target.status !== "invited")) throw new ActionError("Người này không còn trong dự án.");
  if (!canRemoveMember(await activeRole(projectId, actor.id), target.role, manageAny(actor))) {
    await audit(actor.id, "project.member.remove", `project:${projectId}/member:${memberId}`, "failure");
    throw new ActionError(target.role === "owner" ? "Không thể loại chủ dự án." : "Chỉ chủ dự án được loại thành viên.");
  }
  await run("UPDATE prj_members SET status = 'removed', updated_at = ? WHERE project_id = ? AND member_id = ?", [now(), projectId, memberId]);
  await run("UPDATE prj_tasks SET assignee_id = NULL, updated_at = ? WHERE project_id = ? AND assignee_id = ? AND status NOT IN ('done','cancelled')", [now(), projectId, memberId]);
  await audit(actor.id, "project.member.remove", `project:${projectId}/member:${memberId}`, "success");
  const pr = await projectRow(projectId);
  await notify(memberId, { category: "projects", title: `Bạn không còn là thành viên dự án “${(pr?.title ?? "").slice(0, 60)}”`, href: "/projects/mine" });
}

export async function leaveProject(actor: Actor, projectId: string): Promise<void> {
  const m = await membership(projectId, actor.id);
  if (m?.status !== "active") throw new ActionError("Bạn không ở trong dự án.");
  if (m.role === "owner") throw new ActionError("Chủ dự án không thể rời; hãy lưu trữ dự án.");
  await run("UPDATE prj_members SET status = 'left', updated_at = ? WHERE project_id = ? AND member_id = ?", [now(), projectId, actor.id]);
  await run("UPDATE prj_tasks SET assignee_id = NULL, updated_at = ? WHERE project_id = ? AND assignee_id = ? AND status NOT IN ('done','cancelled')", [now(), projectId, actor.id]);
}

/** Owner (or Chủ nhiệm) promotes a member to lead or demotes a lead. Mentors keep their role. */
export async function setMemberRole(actor: Actor, projectId: string, memberId: string, role: "lead" | "member"): Promise<void> {
  const caps = projectCaps(await activeRole(projectId, actor.id), manageAny(actor));
  if (!caps.changeRoles) throw new ActionError("Chỉ chủ dự án được đổi vai trò.");
  const target = await membership(projectId, memberId);
  if (target?.status !== "active" || (target.role !== "lead" && target.role !== "member")) throw new ActionError("Không đổi được vai trò người này.");
  await run("UPDATE prj_members SET role = ?, updated_at = ? WHERE project_id = ? AND member_id = ?", [role, now(), projectId, memberId]);
  await audit(actor.id, "project.member.role", `project:${projectId}/member:${memberId}`, "success");
}

// ───────────────────────── Workspace: tasks, updates, links ─────────────────────────

async function requireWorkspace(actor: Actor, projectId: string) {
  const p = await requireProject(projectId);
  const role = await activeRole(projectId, actor.id);
  const staff = manageAny(actor);
  const caps = projectCaps(role, staff);
  if (!caps.viewWorkspace) throw new ActionError("Chỉ thành viên dự án được vào không gian làm việc.");
  return { p, role, staff, caps };
}
const writable = (s: ProjectStatus) => s === "active" || s === "draft";

export type Task = { id: string; title: string; description: string; status: TaskStatus; assigneeId: string | null; assigneeName: string | null; dueDate: string | null; createdBy: string; canEdit: boolean };

export async function listTasks(actor: Actor, projectId: string): Promise<{ tasks: Task[]; team: { id: string; name: string }[] }> {
  const { role, staff } = await requireWorkspace(actor, projectId);
  const rows = await all<{ id: string; title: string; description: string; status: TaskStatus; assignee_id: string | null; assignee_name: string | null; due_date: string | null; created_by: string }>(
    `SELECT t.*, m.full_name AS assignee_name FROM prj_tasks t LEFT JOIN members m ON m.id = t.assignee_id WHERE t.project_id = ?
     ORDER BY CASE t.status WHEN 'in_progress' THEN 0 WHEN 'review' THEN 1 WHEN 'todo' THEN 2 WHEN 'backlog' THEN 3 WHEN 'done' THEN 4 ELSE 5 END, t.due_date IS NULL, t.due_date, t.created_at`,
    [projectId],
  );
  const team = await all<{ id: string; name: string }>(
    "SELECT m.id, m.full_name AS name FROM prj_members pm JOIN members m ON m.id = pm.member_id WHERE pm.project_id = ? AND pm.status = 'active' AND pm.role != 'mentor' ORDER BY m.full_name",
    [projectId],
  );
  return {
    tasks: rows.map((r) => ({
      id: r.id,
      title: r.title,
      description: r.description,
      status: r.status,
      assigneeId: r.assignee_id,
      assigneeName: r.assignee_name,
      dueDate: r.due_date,
      createdBy: r.created_by,
      canEdit: canEditTask(role, { assigneeId: r.assignee_id, createdBy: r.created_by }, actor.id, staff),
    })),
    team,
  };
}

const taskSchema = z.object({
  title: z.string().trim().min(3, "Tên công việc tối thiểu 3 ký tự.").max(150),
  description: z.string().trim().max(2000).default(""),
  assigneeId: z.string().nullable().default(null),
  dueDate: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, "Hạn không hợp lệ.")
    .nullable()
    .or(z.literal("").transform(() => null))
    .default(null),
  status: z.enum(TASK_STATUSES).default("todo"),
});

async function checkAssignee(projectId: string, assigneeId: string | null, actor: Actor, role: MemberRole | null, staff: { manageAny: boolean }) {
  if (!assigneeId) return;
  const r = await activeRole(projectId, assigneeId);
  if (!r || r === "mentor") throw new ActionError("Chỉ giao việc cho thành viên đang hoạt động của dự án.");
  if (assigneeId !== actor.id && role !== "owner" && role !== "lead" && !staff.manageAny) throw new ActionError("Thành viên chỉ tự nhận việc; giao cho người khác cần Chủ dự án / Trưởng nhóm.");
}

/** PRO-15 Project Tasks: owner, lead and members create tasks (members may only self-assign). */
export async function createTask(actor: Actor, projectId: string, input: unknown): Promise<string> {
  const { p, role, staff, caps } = await requireWorkspace(actor, projectId);
  if (!caps.createTasks && !staff.manageAny) throw new ActionError("Bạn không có quyền tạo công việc.");
  if (!writable(p.status)) throw new ActionError("Dự án không còn hoạt động.");
  const d = taskSchema.parse(input);
  if (!allowedTaskStatus(role, d.status, staff)) throw new ActionError("Chỉ Chủ dự án / Trưởng nhóm được đóng công việc.");
  await checkAssignee(projectId, d.assigneeId, actor, role, staff);
  const id = randomUUID();
  await run(
    "INSERT INTO prj_tasks (id, project_id, title, description, status, assignee_id, due_date, created_by, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
    [id, projectId, d.title, d.description, d.status, d.assigneeId, d.dueDate, actor.id, now(), now()],
  );
  if (d.assigneeId && d.assigneeId !== actor.id) {
    await notify(d.assigneeId, { category: "projects", title: `Bạn được giao việc: ${d.title.slice(0, 80)}`, body: p.title.slice(0, 120), href: `/projects/p/${projectId}/workspace` });
  }
  return id;
}

export async function updateTask(actor: Actor, taskId: string, input: unknown): Promise<void> {
  const t = await one<{ project_id: string; assignee_id: string | null; created_by: string; status: TaskStatus }>("SELECT project_id, assignee_id, created_by, status FROM prj_tasks WHERE id = ?", [taskId]);
  if (!t) throw new ActionError("Không tìm thấy công việc.");
  const { p, role, staff } = await requireWorkspace(actor, t.project_id);
  if (!writable(p.status)) throw new ActionError("Dự án không còn hoạt động.");
  if (!canEditTask(role, { assigneeId: t.assignee_id, createdBy: t.created_by }, actor.id, staff)) throw new ActionError("Bạn chỉ sửa được công việc của mình.");
  const d = taskSchema.parse(input);
  if (d.status !== t.status && !allowedTaskStatus(role, d.status, staff)) throw new ActionError("Chuyển sang “Chờ duyệt”; Chủ dự án / Trưởng nhóm sẽ đóng công việc.");
  if (d.assigneeId !== t.assignee_id) await checkAssignee(t.project_id, d.assigneeId, actor, role, staff);
  await run("UPDATE prj_tasks SET title = ?, description = ?, status = ?, assignee_id = ?, due_date = ?, updated_at = ? WHERE id = ?", [
    d.title,
    d.description,
    d.status,
    d.assigneeId,
    d.dueDate,
    now(),
    taskId,
  ]);
  if (d.assigneeId && d.assigneeId !== t.assignee_id && d.assigneeId !== actor.id) {
    await notify(d.assigneeId, { category: "projects", title: `Bạn được giao việc: ${d.title.slice(0, 80)}`, body: p.title.slice(0, 120), href: `/projects/p/${t.project_id}/workspace` });
  }
}

export async function deleteTask(actor: Actor, taskId: string): Promise<void> {
  const t = await one<{ project_id: string; created_by: string }>("SELECT project_id, created_by FROM prj_tasks WHERE id = ?", [taskId]);
  if (!t) throw new ActionError("Không tìm thấy công việc.");
  const { role, staff } = await requireWorkspace(actor, t.project_id);
  if (!(role === "owner" || role === "lead" || staff.manageAny || t.created_by === actor.id)) throw new ActionError("Chỉ người tạo hoặc Chủ dự án / Trưởng nhóm được xóa công việc.");
  await run("DELETE FROM prj_tasks WHERE id = ?", [taskId]);
}

export type Update = { id: string; authorName: string; kind: "update" | "milestone"; body: string; createdAt: string; canDelete: boolean };

/** PRO-16/18 Timeline & discussion: team-only feed of updates and milestones. */
export async function listUpdates(actor: Actor, projectId: string): Promise<Update[]> {
  const { role, staff } = await requireWorkspace(actor, projectId);
  const rows = await all<{ id: string; author_id: string; full_name: string; kind: "update" | "milestone"; body: string; created_at: string }>(
    "SELECT u.*, m.full_name FROM prj_updates u JOIN members m ON m.id = u.author_id WHERE u.project_id = ? ORDER BY u.created_at DESC LIMIT 100",
    [projectId],
  );
  return rows.map((r) => ({ id: r.id, authorName: r.full_name, kind: r.kind, body: r.body, createdAt: r.created_at, canDelete: r.author_id === actor.id || role === "owner" || staff.manageAny }));
}

export async function postUpdate(actor: Actor, projectId: string, input: unknown): Promise<void> {
  const { p, role, staff } = await requireWorkspace(actor, projectId);
  if (p.status === "archived") throw new ActionError("Dự án đã lưu trữ.");
  const d = z.object({ body: z.string().trim().min(2, "Nội dung quá ngắn.").max(2000), kind: z.enum(["update", "milestone"]).default("update") }).parse(input);
  if (d.kind === "milestone" && role !== "owner" && role !== "lead" && !staff.manageAny) throw new ActionError("Chỉ Chủ dự án / Trưởng nhóm đăng cột mốc.");
  await run("INSERT INTO prj_updates (id, project_id, author_id, kind, body, created_at) VALUES (?, ?, ?, ?, ?, ?)", [randomUUID(), projectId, actor.id, d.kind, d.body, now()]);
}

export async function deleteUpdate(actor: Actor, updateId: string): Promise<void> {
  const u = await one<{ project_id: string; author_id: string }>("SELECT project_id, author_id FROM prj_updates WHERE id = ?", [updateId]);
  if (!u) throw new ActionError("Không tìm thấy bài viết.");
  const { role, staff } = await requireWorkspace(actor, u.project_id);
  if (u.author_id !== actor.id && role !== "owner" && !staff.manageAny) throw new ActionError("Bạn chỉ xóa được bài của mình.");
  await run("DELETE FROM prj_updates WHERE id = ?", [updateId]);
}

const linkSchema = z.object({
  kind: z.enum(Object.keys(LINK_KINDS) as [LinkKind, ...LinkKind[]]),
  title: z.string().trim().min(2, "Nhập tên liên kết.").max(100),
  url: z.string().trim().max(500),
  visibility: z.enum(["public", "team"]).default("team"),
});

/** PRO-17/19 Documents & Demo: https links with public / team-only access control. */
export async function addLink(actor: Actor, projectId: string, input: unknown): Promise<void> {
  const { p, caps } = await requireWorkspace(actor, projectId);
  if (!caps.manageLinks) throw new ActionError("Chỉ Chủ dự án / Trưởng nhóm được thêm tài liệu.");
  if (p.status === "archived") throw new ActionError("Dự án đã lưu trữ.");
  const d = linkSchema.parse(input);
  const url = safeHttpsUrl(d.url);
  if (!url) throw new ActionError("Liên kết phải bắt đầu bằng https://");
  await run("INSERT INTO prj_links (id, project_id, kind, title, url, visibility, created_by, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)", [
    randomUUID(),
    projectId,
    d.kind,
    d.title,
    url,
    d.visibility,
    actor.id,
    now(),
  ]);
}

export async function removeLink(actor: Actor, linkId: string): Promise<void> {
  const l = await one<{ project_id: string }>("SELECT project_id FROM prj_links WHERE id = ?", [linkId]);
  if (!l) throw new ActionError("Không tìm thấy liên kết.");
  const { caps } = await requireWorkspace(actor, l.project_id);
  if (!caps.manageLinks) throw new ActionError("Chỉ Chủ dự án / Trưởng nhóm được xóa tài liệu.");
  await run("DELETE FROM prj_links WHERE id = ?", [linkId]);
}

// ───────────────────────── Feedback & analytics ─────────────────────────

/** PRO-20 Feedback & Rating: non-members rate public projects once (editable). */
export async function giveFeedback(actor: Actor, projectId: string, input: unknown): Promise<void> {
  const p = await requireProject(projectId);
  if (!isPublicStatus(p.status)) throw new ActionError("Chỉ đánh giá được dự án đang công khai.");
  const m = await membership(projectId, actor.id);
  if (m?.status === "active") throw new ActionError("Thành viên dự án không tự đánh giá dự án của mình.");
  const d = z.object({ rating: z.number().int().min(1).max(5), comment: z.string().trim().max(1000).default("") }).parse(input);
  const t = now();
  await run(
    `INSERT INTO prj_feedback (id, project_id, author_id, rating, comment, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?)
     ON CONFLICT (project_id, author_id) DO UPDATE SET rating = excluded.rating, comment = excluded.comment, updated_at = excluded.updated_at`,
    [randomUUID(), projectId, actor.id, d.rating, d.comment, t, t],
  );
  await notify(p.owner_id, { category: "projects", title: `Dự án “${p.title.slice(0, 60)}” nhận đánh giá ${d.rating}★`, body: d.comment.slice(0, 200), href: `/projects/p/${projectId}`, dedupeKey: `feedback:${projectId}:${actor.id}:${t}` });
}

/** Moderation (FR-PROJ-005 "có moderation"): approvers / Chủ nhiệm hide or unhide feedback. Owners cannot hide criticism. */
export async function setFeedbackHidden(actor: Actor, feedbackId: string, hidden: boolean): Promise<void> {
  if (!can(actor, "project.approve") && !can(actor, "project.manage_any")) throw new ActionError("Bạn không có quyền kiểm duyệt phản hồi.");
  const res = await run("UPDATE prj_feedback SET hidden = ? WHERE id = ?", [hidden ? 1 : 0, feedbackId]);
  if (res !== 1) throw new ActionError("Không tìm thấy phản hồi.");
  await audit(actor.id, hidden ? "project.feedback.hide" : "project.feedback.unhide", `feedback:${feedbackId}`, "success");
}

export type ProjectAnalytics = {
  views30d: number;
  uniqueViewers: number;
  team: number;
  mentors: number;
  pendingRequests: number;
  tasksByStatus: Record<TaskStatus, number>;
  progress: { done: number; total: number; percent: number };
  overdue: number;
  rating: number | null;
  ratingCount: number;
  updates30d: number;
};

/** PRO-21 Project Analytics (FR-PROJ-007): view / engagement / progress metrics for owner & lead. */
export async function projectAnalytics(actor: Actor, projectId: string): Promise<ProjectAnalytics> {
  const { caps } = await requireWorkspace(actor, projectId);
  if (!caps.viewAnalytics) throw new ActionError("Chỉ Chủ dự án / Trưởng nhóm xem thống kê.");
  const since = new Date(Date.now() - 30 * 86_400_000).toISOString().slice(0, 10);
  const v = await one<{ views: number; uniq: number }>("SELECT COUNT(*) AS views, COUNT(DISTINCT member_id) AS uniq FROM prj_views WHERE project_id = ? AND day >= ?", [projectId, since]);
  const members = await all<{ role: MemberRole; status: MemberStatus }>("SELECT role, status FROM prj_members WHERE project_id = ?", [projectId]);
  const tasks = await all<{ status: TaskStatus; due_date: string | null }>("SELECT status, due_date FROM prj_tasks WHERE project_id = ?", [projectId]);
  const fb = await one<{ avg: number | null; n: number }>("SELECT AVG(rating) AS avg, COUNT(*) AS n FROM prj_feedback WHERE project_id = ? AND hidden = 0", [projectId]);
  const up = await one<{ n: number }>("SELECT COUNT(*) AS n FROM prj_updates WHERE project_id = ? AND created_at >= ?", [projectId, since]);
  const tasksByStatus = Object.fromEntries(TASK_STATUSES.map((s) => [s, 0])) as Record<TaskStatus, number>;
  for (const t of tasks) tasksByStatus[t.status] = (tasksByStatus[t.status] ?? 0) + 1;
  const day = today();
  return {
    views30d: Number(v?.views ?? 0),
    uniqueViewers: Number(v?.uniq ?? 0),
    team: members.filter((m) => m.status === "active" && m.role !== "mentor").length,
    mentors: members.filter((m) => m.status === "active" && m.role === "mentor").length,
    pendingRequests: members.filter((m) => m.status === "requested").length,
    tasksByStatus,
    progress: projectProgress(tasks),
    overdue: tasks.filter((t) => t.due_date && t.due_date < day && t.status !== "done" && t.status !== "cancelled").length,
    rating: fb?.avg == null ? null : Math.round(Number(fb.avg) * 10) / 10,
    ratingCount: Number(fb?.n ?? 0),
    updates30d: Number(up?.n ?? 0),
  };
}

/** PRO-10 Mentor discovery: people currently mentoring public projects. */
export async function listMentors(): Promise<{ memberId: string; name: string; projects: number }[]> {
  return all<{ memberId: string; name: string; projects: number }>(
    `SELECT m.id AS memberId, m.full_name AS name, COUNT(*) AS projects FROM prj_members pm
     JOIN members m ON m.id = pm.member_id JOIN prj_projects p ON p.id = pm.project_id
     WHERE pm.role = 'mentor' AND pm.status = 'active' AND p.status IN ('active','completed')
     GROUP BY m.id ORDER BY projects DESC, m.full_name LIMIT 50`,
  );
}

/** PRO-01 Home stats. */
export async function projectHomeStats(actor: Actor): Promise<{ active: number; recruiting: number; mine: number; invites: number }> {
  const r = await one<{ active: number; recruiting: number }>(
    "SELECT SUM(status = 'active') AS active, SUM(status = 'active' AND recruiting = 1) AS recruiting FROM prj_projects",
  );
  const m = await one<{ mine: number; invites: number }>(
    "SELECT SUM(status = 'active') AS mine, SUM(status = 'invited') AS invites FROM prj_members WHERE member_id = ?",
    [actor.id],
  );
  return { active: Number(r?.active ?? 0), recruiting: Number(r?.recruiting ?? 0), mine: Number(m?.mine ?? 0), invites: Number(m?.invites ?? 0) };
}

/**
 * Project Marketplace rules (FR-PROJ-001…008, SRS §9, BR-006). Pure and unit tested.
 *
 * Lifecycle:
 *   draft ─submit─▶ submitted ─approve─▶ active ─complete─▶ completed
 *     ▲                │ reject (reason)    │  ▲ reopen ◀──────┘
 *     └── rejected ◀───┘                    └──┴─ archive ─▶ archived ─restore (approver)─▶ active
 *
 * An owner who also holds `project.approve` goes straight to active (no self-review step).
 */

export const PROJECT_STATUSES = ["draft", "submitted", "active", "completed", "archived", "rejected"] as const;
export type ProjectStatus = (typeof PROJECT_STATUSES)[number];
export type ProjectAction = "submit" | "approve" | "reject" | "complete" | "reopen" | "archive" | "restore";

export const PROJECT_STATUS_LABEL: Record<ProjectStatus, string> = {
  draft: "Nháp",
  submitted: "Chờ duyệt",
  active: "Đang hoạt động",
  completed: "Đã hoàn thành",
  archived: "Đã lưu trữ",
  rejected: "Bị từ chối",
};
export const PROJECT_STATUS_TONE: Record<ProjectStatus, "muted" | "warning" | "income" | "expense" | "primary"> = {
  draft: "muted",
  submitted: "warning",
  active: "income",
  completed: "primary",
  archived: "muted",
  rejected: "expense",
};

export const PROJECT_CATEGORIES = {
  fintech: "Tài chính / Fintech",
  education: "Giáo dục",
  community: "Cộng đồng",
  research: "Nghiên cứu",
  startup: "Khởi nghiệp",
  media: "Truyền thông",
  other: "Khác",
} as const;
export type ProjectCategory = keyof typeof PROJECT_CATEGORIES;

export function isProjectStatus(v: unknown): v is ProjectStatus {
  return typeof v === "string" && (PROJECT_STATUSES as readonly string[]).includes(v);
}

export type Who = {
  isOwner: boolean;
  /** `project.approve` (Chủ nhiệm, Ban điều hành, Trưởng ban Chuyên môn). */
  canApprove: boolean;
  /** `project.archive_any`. */
  canArchiveAny: boolean;
};

export type TransitionResult = { ok: true; to: ProjectStatus } | { ok: false; error: string };

export function applyProjectAction(action: ProjectAction, from: ProjectStatus, who: Who, reason?: string): TransitionResult {
  const deny = (error: string): TransitionResult => ({ ok: false, error });
  switch (action) {
    case "submit":
      if (!who.isOwner) return deny("Chỉ chủ dự án được gửi duyệt.");
      if (from !== "draft" && from !== "rejected") return deny("Chỉ gửi duyệt được bản nháp hoặc dự án bị từ chối.");
      return { ok: true, to: who.canApprove ? "active" : "submitted" };
    case "approve":
      if (!who.canApprove) return deny("Bạn không có quyền duyệt dự án.");
      if (from !== "submitted") return deny("Chỉ duyệt được dự án đang chờ duyệt.");
      return { ok: true, to: "active" };
    case "reject":
      if (!who.canApprove) return deny("Bạn không có quyền duyệt dự án.");
      if (from !== "submitted" && from !== "active") return deny("Không thể từ chối ở trạng thái này.");
      if (!reason?.trim()) return deny("Cần ghi lý do để chủ dự án chỉnh sửa.");
      return { ok: true, to: "rejected" };
    case "complete":
      if (!who.isOwner) return deny("Chỉ chủ dự án được đánh dấu hoàn thành.");
      if (from !== "active") return deny("Chỉ dự án đang hoạt động mới hoàn thành được.");
      return { ok: true, to: "completed" };
    case "reopen":
      if (!who.isOwner) return deny("Chỉ chủ dự án được mở lại.");
      if (from !== "completed") return deny("Chỉ mở lại được dự án đã hoàn thành.");
      return { ok: true, to: "active" };
    case "archive":
      if (!who.isOwner && !who.canArchiveAny) return deny("Bạn không có quyền lưu trữ dự án này.");
      if (from !== "active" && from !== "completed") return deny("Chỉ lưu trữ được dự án đang hoạt động hoặc đã hoàn thành.");
      return { ok: true, to: "archived" };
    case "restore":
      if (!who.canApprove) return deny("Chỉ người duyệt dự án được khôi phục.");
      if (from !== "archived") return deny("Chỉ khôi phục được dự án đã lưu trữ.");
      return { ok: true, to: "active" };
  }
}

/** Actions a UI may offer (each is still re-checked by applyProjectAction on the server). */
export function availableProjectActions(status: ProjectStatus, who: Who): ProjectAction[] {
  const all: ProjectAction[] = ["submit", "approve", "reject", "complete", "reopen", "archive", "restore"];
  return all.filter((a) => applyProjectAction(a, status, who, "x").ok);
}

/** Public (any signed-in member) sees active and completed projects; the team and approvers see the rest. */
export function isPublicStatus(s: ProjectStatus): boolean {
  return s === "active" || s === "completed";
}

/** Owners edit anything but archived; editing an active project does not re-trigger review (FR-PROJ-006 "khi policy yêu cầu"). */
export function canEditProject(status: ProjectStatus, who: Who): boolean {
  if (status === "archived") return false;
  if (status === "submitted") return who.canApprove;
  return who.isOwner || who.canApprove;
}

// ───────────── Membership (FR-PROJ-002 / 003) ─────────────

export const MEMBER_ROLES = ["owner", "lead", "member", "mentor"] as const;
export type MemberRole = (typeof MEMBER_ROLES)[number];
export type MemberStatus = "invited" | "requested" | "active" | "declined" | "removed" | "left";

export const MEMBER_ROLE_LABEL: Record<MemberRole, string> = {
  owner: "Chủ dự án",
  lead: "Trưởng nhóm",
  member: "Thành viên",
  mentor: "Mentor",
};

/** What one actor may do inside one project. `role` is null for non-members. */
export type ProjectCaps = {
  viewWorkspace: boolean;
  /** Invite people, accept / decline join requests. */
  admitMembers: boolean;
  /** Remove (kick) other members. */
  removeMembers: boolean;
  changeRoles: boolean;
  manageTasks: boolean;
  createTasks: boolean;
  manageLinks: boolean;
  viewAnalytics: boolean;
  postUpdates: boolean;
  giveFeedback: boolean;
};

export function projectCaps(role: MemberRole | null, staff: { manageAny: boolean }): ProjectCaps {
  const owner = role === "owner" || staff.manageAny;
  const lead = role === "lead";
  const team = role !== null;
  return {
    viewWorkspace: team || staff.manageAny,
    admitMembers: owner || lead,
    removeMembers: owner,
    changeRoles: owner,
    manageTasks: owner || lead,
    createTasks: role === "owner" || lead || role === "member",
    manageLinks: owner || lead,
    viewAnalytics: owner || lead,
    postUpdates: team,
    giveFeedback: !team,
  };
}

/** Who may remove whom: owner (or Chủ nhiệm) removes anyone except the owner; nobody else removes anyone. */
export function canRemoveMember(actorRole: MemberRole | null, targetRole: MemberRole, staff: { manageAny: boolean }): boolean {
  if (targetRole === "owner") return false;
  return actorRole === "owner" || staff.manageAny;
}

/** Leads may invite plain members only; owners invite leads, members and mentors. Nobody invites a second owner. */
export function canInviteAs(actorRole: MemberRole | null, invitedRole: MemberRole, staff: { manageAny: boolean }): boolean {
  if (invitedRole === "owner") return false;
  if (actorRole === "owner" || staff.manageAny) return true;
  return actorRole === "lead" && invitedRole === "member";
}

// ───────────── Tasks (SRS §9 Task) ─────────────

export const TASK_STATUSES = ["backlog", "todo", "in_progress", "review", "done", "cancelled"] as const;
export type TaskStatus = (typeof TASK_STATUSES)[number];
export const TASK_STATUS_LABEL: Record<TaskStatus, string> = {
  backlog: "Backlog",
  todo: "Cần làm",
  in_progress: "Đang làm",
  review: "Chờ duyệt",
  done: "Xong",
  cancelled: "Đã hủy",
};

/** Owner / lead edit every task; a member edits tasks assigned to or created by them; mentors only comment. */
export function canEditTask(role: MemberRole | null, task: { assigneeId: string | null; createdBy: string }, actorId: string, staff: { manageAny: boolean }): boolean {
  if (role === "owner" || role === "lead" || staff.manageAny) return true;
  if (role === "member") return task.assigneeId === actorId || task.createdBy === actorId;
  return false;
}

/** Members cannot mark a task "done" themselves when it needs review: they move it to review; owner/lead close it. */
export function allowedTaskStatus(role: MemberRole | null, to: TaskStatus, staff: { manageAny: boolean }): boolean {
  if (role === "owner" || role === "lead" || staff.manageAny) return true;
  return to !== "done" && to !== "cancelled";
}

export function projectProgress(tasks: { status: TaskStatus }[]): { done: number; total: number; percent: number } {
  const counted = tasks.filter((t) => t.status !== "cancelled");
  const done = counted.filter((t) => t.status === "done").length;
  return { done, total: counted.length, percent: counted.length ? Math.round((done / counted.length) * 100) : 0 };
}

// ───────────── Links / demo (FR-PROJ-004) ─────────────

export const LINK_KINDS = { demo: "Demo", repo: "Mã nguồn", doc: "Tài liệu", design: "Thiết kế" } as const;
export type LinkKind = keyof typeof LINK_KINDS;

/** Only https links (no javascript:, data:, http:) are stored. */
export function safeHttpsUrl(raw: string): string | null {
  try {
    const u = new URL(raw.trim());
    return u.protocol === "https:" && u.hostname.includes(".") ? u.toString() : null;
  } catch {
    return null;
  }
}

export function parseSkills(raw: string): string[] {
  const seen = new Map<string, string>();
  for (const s of raw.split(",")) {
    const t = s.trim().slice(0, 30);
    if (t && !seen.has(t.toLowerCase()) && seen.size < 10) seen.set(t.toLowerCase(), t);
  }
  return [...seen.values()];
}

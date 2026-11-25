/** Club Management API shapes (PFC-Management/apps/club, action=home) and Vietnamese labels. */
export type Position = "owner" | "leader" | "ban_chuyen_mon" | "ban_truyen_thong" | "ban_su_kien" | "member";
export type MembershipStatus = "pending" | "active" | "inactive" | "rejected" | "left" | "alumni";
export type TaskStatus = "backlog" | "todo" | "in_progress" | "review" | "done" | "cancelled";
export type Priority = "low" | "medium" | "high";

export type Member = {
  id: string; // membership id
  memberId: string;
  position: Position;
  status: MembershipStatus;
  teamId?: string | null;
  teamName?: string | null;
  joinReason?: string | null;
  createdAt?: string | null;
  joinedAt?: string | null;
  fullName?: string;
  email?: string;
  studentCode?: string;
  tasksDone?: number;
  tasksTotal?: number;
  eventsJoined?: number;
};

export type BoardTask = {
  id: string;
  title: string;
  status: TaskStatus;
  priority: Priority;
  description?: string;
  deadline?: string | null;
  progress?: number;
  progressPct?: number;
  assigneeId?: string | null;
  assigneeName?: string | null;
  assigneeInitials?: string | null;
  teamId?: string | null;
  teamName?: string | null;
  activityTitle?: string | null;
  checklistDone?: number;
  checklistTotal?: number;
  commentCount?: number;
  updatedAt?: string | number | null;
};

export type Activity = {
  id: string;
  title: string;
  status: string;
  description?: string;
  mode?: string;
  location?: string | null;
  startsAt?: string | null;
  endsAt?: string | null;
  capacity?: number | null;
  participantCount?: number | null;
  coverUrl?: string | null;
  mediaUrls?: string[];
  bodyMd?: string;
  registerDeadline?: string | null;
  hostTeamId?: string | null;
};

export type LinkedEvent = {
  id: string;
  externalEventId: string;
  label: string | null;
  event?: {
    title: string;
    status: string;
    startsAt: string | null;
    mode: string;
    location?: string | null;
    summary?: string | null;
    capacity?: number | null;
    registeredCount?: number | null;
    degraded: boolean;
  } | null;
};

export type ClubNotification = {
  id: string;
  type: string;
  title: string;
  body: string;
  createdAt: string | number;
  readAt?: string | number | null;
  unread: boolean;
};

export type ClubHome = {
  club: { id: string; name: string; description: string; visibility: string; status: string };
  teams: Array<{ id: string; name: string; description?: string; memberCount?: number }>;
  myMembership?: { id: string; status: MembershipStatus; position: Position; teamId?: string | null } | null;
  user: { id: string; email: string; fullName: string; isSuperAdmin?: boolean };
  permissions: string[];
  report: {
    members: { total: number; active: number; pending: number; joinedThisMonth?: number };
    tasks: { total: number; byStatus: Record<string, number>; doneThisMonth?: number };
    activities: number;
    documents: number;
    linkedEvents: number;
  } | null;
  members: Member[];
  kanban: Partial<Record<TaskStatus, BoardTask[]>>;
  taskScope: { canManageTasks: boolean; assigneeOnly: boolean; canFilterAllTeams: boolean } | null;
  activities: Activity[];
  documents: Array<{ id: string; title: string }>;
  links: LinkedEvent[];
  approvalQueue?: {
    memberships: Array<{ id: string; fullName?: string; email?: string; joinReason?: string | null; createdAt?: string | null }>;
    taskReviews: Array<{ id: string; title: string; priority: Priority }>;
  };
  notifications: ClubNotification[];
};

export type TaskDetail = {
  task: BoardTask & { clubId: string };
  checklist: Array<{ id: string; title: string; done: boolean }>;
  comments: Array<{ id: string; body: string; createdAt: string | number; authorName: string | null }>;
  activity?: Array<{ id: string; action?: string; createdAt: string | number }>;
  attachments?: TaskAttachment[];
};

export type TaskAttachment = { id: string; name: string; url: string; mimeType: string; sizeBytes: number; uploaderId: string; uploaderName: string | null; createdAt: number };

export const POSITION_LABEL: Record<Position, string> = {
  owner: "Chủ nhiệm",
  leader: "Ban Điều hành",
  ban_chuyen_mon: "Ban Chuyên môn",
  ban_truyen_thong: "Ban Truyền thông",
  ban_su_kien: "Ban Sự kiện",
  member: "Thành viên",
};

export const MEMBERSHIP_LABEL: Record<MembershipStatus, string> = {
  pending: "Chờ duyệt",
  active: "Đang hoạt động",
  inactive: "Tạm dừng",
  rejected: "Từ chối",
  left: "Đã rời",
  alumni: "Cựu thành viên",
};

export const TASK_STATUS_LABEL: Record<TaskStatus, string> = {
  backlog: "Backlog",
  todo: "Cần làm",
  in_progress: "Đang làm",
  review: "Chờ duyệt",
  done: "Hoàn thành",
  cancelled: "Đã hủy",
};

export const KANBAN_COLUMNS: TaskStatus[] = ["backlog", "todo", "in_progress", "review", "done"];

/** Mirrors Club ADR-002 TASK_TRANSITIONS (server enforces; UI only offers valid moves). */
export const TASK_NEXT: Record<TaskStatus, TaskStatus[]> = {
  backlog: ["todo", "cancelled"],
  todo: ["in_progress", "cancelled"],
  in_progress: ["review", "cancelled"],
  review: ["done", "in_progress", "cancelled"],
  done: [],
  cancelled: [],
};

/** Mirrors Club membership FSM. */
export const MEMBERSHIP_NEXT: Record<MembershipStatus, MembershipStatus[]> = {
  pending: ["active", "rejected"],
  active: ["inactive", "left", "alumni"],
  inactive: ["active", "left"],
  rejected: [],
  left: ["active"],
  alumni: ["active"],
};

export const PRIORITY: Record<Priority, { label: string; tone: "muted" | "warning" | "expense" }> = {
  low: { label: "Thấp", tone: "muted" },
  medium: { label: "Trung bình", tone: "warning" },
  high: { label: "Cao", tone: "expense" },
};

export function toDate(v: string | number | null | undefined): Date | null {
  if (v === null || v === undefined || v === "") return null;
  const d = new Date(v);
  return Number.isNaN(d.getTime()) ? null : d;
}

export function fmtDate(v: string | number | null | undefined): string {
  const d = toDate(v);
  return d ? d.toLocaleDateString("vi-VN", { day: "2-digit", month: "2-digit", year: "numeric" }) : "—";
}

export function fmtDateTime(v: string | number | null | undefined): string {
  const d = toDate(v);
  return d ? d.toLocaleString("vi-VN", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" }) : "—";
}

export function initials(name: string | null | undefined): string {
  return (name ?? "?")
    .trim()
    .split(/\s+/)
    .slice(-2)
    .map((w) => w[0]?.toUpperCase() ?? "")
    .join("");
}

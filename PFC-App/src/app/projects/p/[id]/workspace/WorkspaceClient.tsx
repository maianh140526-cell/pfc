"use client";

import { useState } from "react";
import { ExternalLink, Flag, Plus, Trash2 } from "lucide-react";
import { LINK_KINDS, MEMBER_ROLE_LABEL, TASK_STATUS_LABEL, TASK_STATUSES, type LinkKind, type MemberStatus, type TaskStatus } from "@/modules/projects/domain/projects";
import {
  addLinkAction,
  createTaskAction,
  decideRequestAction,
  deleteTaskAction,
  deleteUpdateAction,
  inviteMemberAction,
  postUpdateAction,
  removeLinkAction,
  removeMemberAction,
  setMemberRoleAction,
  updateTaskAction,
} from "@/modules/projects/server/actions";
import type { Task, TeamMember, Update } from "@/modules/projects/server/service";
import { Badge, BottomSheet, Button, Card, EmptyState, Section } from "@/ui";
import { ConfirmSheet } from "@/ui/ConfirmSheet";
import { FormError, SelectInput, TextArea, TextInput, Toggle } from "@/ui/Form";
import { cx } from "@/ui/cx";
import { useAction } from "@/ui/use-action";

// ───────────────────────── Tasks ─────────────────────────

type TaskForm = { title: string; description: string; status: TaskStatus; assigneeId: string; dueDate: string };
const TONE: Record<TaskStatus, "muted" | "primary" | "warning" | "income" | "expense"> = {
  backlog: "muted",
  todo: "muted",
  in_progress: "primary",
  review: "warning",
  done: "income",
  cancelled: "expense",
};
const todayStr = () => new Date(Date.now() + 7 * 3600_000).toISOString().slice(0, 10);

export function TaskBoard({
  projectId,
  tasks,
  team,
  myId,
  canCreate,
  canAssignOthers,
  canClose,
}: {
  projectId: string;
  tasks: Task[];
  team: { id: string; name: string }[];
  myId: string;
  canCreate: boolean;
  canAssignOthers: boolean;
  canClose: boolean;
}) {
  const a = useAction();
  const [editing, setEditing] = useState<Task | "new" | null>(null);
  const [form, setForm] = useState<TaskForm>({ title: "", description: "", status: "todo", assigneeId: "", dueDate: "" });
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [filter, setFilter] = useState<"open" | "mine" | "all">("open");

  const open = (t: Task | "new") => {
    setEditing(t);
    setForm(
      t === "new"
        ? { title: "", description: "", status: "todo", assigneeId: canAssignOthers ? "" : myId, dueDate: "" }
        : { title: t.title, description: t.description, status: t.status, assigneeId: t.assigneeId ?? "", dueDate: t.dueDate ?? "" },
    );
  };
  const payload = () => ({ ...form, assigneeId: form.assigneeId || null, dueDate: form.dueDate || null });
  const statusOptions = TASK_STATUSES.filter((s) => canClose || (s !== "done" && s !== "cancelled") || (editing !== "new" && editing?.status === s));
  const assignees = canAssignOthers ? team : team.filter((m) => m.id === myId);
  const shown = tasks.filter((t) => (filter === "all" ? true : filter === "mine" ? t.assigneeId === myId : t.status !== "done" && t.status !== "cancelled"));
  const today = todayStr();

  return (
    <Section
      title={`Công việc (${shown.length})`}
      action={
        canCreate ? (
          <button type="button" onClick={() => open("new")} className="flex items-center gap-1 text-[14px] font-semibold text-primary">
            <Plus size={16} /> Thêm việc
          </button>
        ) : undefined
      }
    >
      <div className="mb-3 flex gap-2">
        {(["open", "mine", "all"] as const).map((f) => (
          <button
            key={f}
            type="button"
            onClick={() => setFilter(f)}
            aria-pressed={filter === f}
            className={cx("rounded-full px-3 py-1.5 text-[13px] font-semibold", filter === f ? "bg-primary text-on-primary" : "border border-line bg-surface text-ink-2")}
          >
            {f === "open" ? "Đang mở" : f === "mine" ? "Của tôi" : "Tất cả"}
          </button>
        ))}
      </div>
      {shown.length === 0 ? (
        <p className="text-[14px] text-muted">Không có công việc.</p>
      ) : (
        <ul className="space-y-2">
          {shown.map((t) => {
            const overdue = t.dueDate && t.dueDate < today && t.status !== "done" && t.status !== "cancelled";
            const body = (
              <>
                <span className="flex items-start justify-between gap-2">
                  <span className={cx("text-[15px] font-semibold text-ink", t.status === "done" && "text-muted line-through")}>{t.title}</span>
                  <Badge tone={TONE[t.status]}>{TASK_STATUS_LABEL[t.status]}</Badge>
                </span>
                <span className="mt-1 block text-[12px] text-muted">
                  {t.assigneeName ?? "Chưa giao"}
                  {t.dueDate && <span className={cx(overdue && "font-semibold text-expense")}> · hạn {t.dueDate.split("-").reverse().join("/")}</span>}
                </span>
              </>
            );
            return (
              <li key={t.id}>
                {t.canEdit ? (
                  <button type="button" onClick={() => open(t)} className="pressable block w-full rounded-[var(--radius-card)] border border-line bg-surface p-3.5 text-left">
                    {body}
                  </button>
                ) : (
                  <div className="rounded-[var(--radius-card)] border border-line bg-surface p-3.5">{body}</div>
                )}
              </li>
            );
          })}
        </ul>
      )}
      <BottomSheet
        open={editing !== null}
        onClose={() => setEditing(null)}
        title={editing === "new" ? "Thêm công việc" : "Sửa công việc"}
        footer={
          <div className="flex gap-2">
            {editing && editing !== "new" && (
              <Button variant="ghost" className="text-expense" aria-label="Xóa công việc" onClick={() => setConfirmDelete(true)}>
                <Trash2 size={18} />
              </Button>
            )}
            <Button
              block
              disabled={a.pending}
              onClick={() =>
                editing === "new"
                  ? a.run(() => createTaskAction(projectId, payload()), () => setEditing(null))
                  : editing && a.run(() => updateTaskAction(editing.id, payload()), () => setEditing(null))
              }
            >
              Lưu
            </Button>
          </div>
        }
      >
        <div className="space-y-3">
          <TextInput label="Tên công việc" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} maxLength={150} />
          <TextArea label="Mô tả" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} maxLength={2000} />
          <div className="grid grid-cols-2 gap-3">
            <SelectInput label="Trạng thái" value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value as TaskStatus })}>
              {statusOptions.map((s) => (
                <option key={s} value={s}>
                  {TASK_STATUS_LABEL[s]}
                </option>
              ))}
            </SelectInput>
            <TextInput label="Hạn" type="date" value={form.dueDate} onChange={(e) => setForm({ ...form, dueDate: e.target.value })} />
          </div>
          <SelectInput label="Người làm" value={form.assigneeId} onChange={(e) => setForm({ ...form, assigneeId: e.target.value })}>
            <option value="">Chưa giao</option>
            {assignees.map((m) => (
              <option key={m.id} value={m.id}>
                {m.name}
                {m.id === myId ? " (tôi)" : ""}
              </option>
            ))}
          </SelectInput>
          {!canClose && <p className="text-[12px] text-muted">Làm xong hãy chuyển sang “Chờ duyệt”; Chủ dự án / Trưởng nhóm sẽ đóng việc.</p>}
          <FormError message={a.error} />
        </div>
      </BottomSheet>
      <ConfirmSheet
        open={confirmDelete}
        onClose={() => setConfirmDelete(false)}
        title="Xóa công việc?"
        message="Công việc sẽ bị xóa khỏi dự án."
        pending={a.pending}
        error={a.error}
        onConfirm={() =>
          editing &&
          editing !== "new" &&
          a.run(
            () => deleteTaskAction(editing.id),
            () => {
              setConfirmDelete(false);
              setEditing(null);
            },
          )
        }
      />
    </Section>
  );
}

// ───────────────────────── Updates / discussion ─────────────────────────

export function UpdatesFeed({ projectId, updates, canMilestone, canPost }: { projectId: string; updates: Update[]; canMilestone: boolean; canPost: boolean }) {
  const a = useAction();
  const [body, setBody] = useState("");
  const [milestone, setMilestone] = useState(false);
  return (
    <Section title="Cập nhật & thảo luận">
      {canPost && (
        <Card className="mb-3 p-3.5">
          <TextArea label="Chia sẻ tiến độ, câu hỏi hoặc góp ý" value={body} onChange={(e) => setBody(e.target.value)} maxLength={2000} />
          {canMilestone && <Toggle label="Đánh dấu là cột mốc" checked={milestone} onChange={setMilestone} />}
          <FormError message={a.error} />
          <Button
            block
            className="mt-2"
            disabled={a.pending || !body.trim()}
            onClick={() =>
              a.run(
                () => postUpdateAction(projectId, { body, kind: milestone ? "milestone" : "update" }),
                () => {
                  setBody("");
                  setMilestone(false);
                },
              )
            }
          >
            Đăng
          </Button>
        </Card>
      )}
      {updates.length === 0 ? (
        <p className="text-[14px] text-muted">Chưa có cập nhật.</p>
      ) : (
        <ol className="space-y-2">
          {updates.map((u) => (
            <li key={u.id} className={cx("rounded-[var(--radius-card)] border bg-surface p-3.5", u.kind === "milestone" ? "border-primary" : "border-line")}>
              <div className="flex items-center justify-between gap-2">
                <p className="flex items-center gap-1.5 text-[14px] font-semibold text-ink">
                  {u.kind === "milestone" && <Flag size={15} className="text-primary" />}
                  {u.authorName}
                </p>
                {u.canDelete && (
                  <button type="button" aria-label="Xóa bài" className="text-muted" disabled={a.pending} onClick={() => a.run(() => deleteUpdateAction(u.id))}>
                    <Trash2 size={16} />
                  </button>
                )}
              </div>
              <p className="mt-1 text-[14px] whitespace-pre-line text-ink-2">{u.body}</p>
              <p className="mt-1 text-[12px] text-muted">{new Date(u.createdAt).toLocaleString("vi-VN")}</p>
            </li>
          ))}
        </ol>
      )}
    </Section>
  );
}

// ───────────────────────── Team ─────────────────────────

const STATUS_TEXT: Partial<Record<MemberStatus, string>> = { requested: "Xin tham gia", invited: "Đã mời" };

export function TeamManager({
  projectId,
  myId,
  team,
  pending,
  caps,
}: {
  projectId: string;
  myId: string;
  team: TeamMember[];
  pending: TeamMember[];
  caps: { admit: boolean; remove: boolean; roles: boolean; inviteMentor: boolean };
}) {
  const a = useAction();
  const [invite, setInvite] = useState(false);
  const [form, setForm] = useState<{ email: string; role: "member" | "lead" | "mentor"; scope: string }>({ email: "", role: "member", scope: "" });
  const [removing, setRemoving] = useState<TeamMember | null>(null);
  return (
    <>
      {caps.admit && (
        <Section
          title={`Chờ xử lý (${pending.length})`}
          action={
            <button type="button" onClick={() => setInvite(true)} className="flex items-center gap-1 text-[14px] font-semibold text-primary">
              <Plus size={16} /> Mời
            </button>
          }
        >
          {pending.length === 0 ? (
            <p className="text-[14px] text-muted">Không có yêu cầu hoặc lời mời đang chờ.</p>
          ) : (
            <ul className="space-y-2">
              {pending.map((m) => (
                <li key={m.memberId}>
                  <Card className="p-3.5">
                    <div className="flex items-center justify-between gap-2">
                      <p className="text-[15px] font-semibold text-ink">{m.name}</p>
                      <Badge tone="warning">
                        {STATUS_TEXT[m.status]} · {MEMBER_ROLE_LABEL[m.role]}
                      </Badge>
                    </div>
                    {m.message && <p className="mt-1 text-[13px] text-ink-2">“{m.message}”</p>}
                    {m.status === "requested" && (
                      <div className="mt-2 flex gap-2">
                        <Button variant="secondary" className="min-h-10 flex-1 text-[14px]" disabled={a.pending} onClick={() => a.run(() => decideRequestAction(projectId, m.memberId, false))}>
                          Từ chối
                        </Button>
                        <Button className="min-h-10 flex-1 text-[14px]" disabled={a.pending} onClick={() => a.run(() => decideRequestAction(projectId, m.memberId, true))}>
                          Nhận
                        </Button>
                      </div>
                    )}
                  </Card>
                </li>
              ))}
            </ul>
          )}
          <FormError message={a.error} />
        </Section>
      )}
      <Section title={`Thành viên (${team.length})`}>
        <ul className="divide-y divide-line overflow-hidden rounded-[var(--radius-card)] border border-line bg-surface">
          {team.map((m) => (
            <li key={m.memberId} className="px-4 py-3">
              <div className="flex items-center justify-between gap-2">
                <span className="min-w-0">
                  <span className="block truncate text-[15px] font-semibold text-ink">
                    {m.name}
                    {m.memberId === myId && <span className="text-muted"> (bạn)</span>}
                  </span>
                  <span className="block truncate text-[12px] text-muted">{m.email}</span>
                </span>
                <Badge tone={m.role === "owner" ? "primary" : "muted"}>{MEMBER_ROLE_LABEL[m.role]}</Badge>
              </div>
              {m.role === "mentor" && m.scope && <p className="mt-1 text-[12px] text-ink-2">Phạm vi: {m.scope}</p>}
              {m.role !== "owner" && m.memberId !== myId && (caps.roles || caps.remove) && (
                <div className="mt-2 flex gap-3 text-[13px] font-semibold">
                  {caps.roles && (m.role === "member" || m.role === "lead") && (
                    <button type="button" className="text-primary" disabled={a.pending} onClick={() => a.run(() => setMemberRoleAction(projectId, m.memberId, m.role === "lead" ? "member" : "lead"))}>
                      {m.role === "lead" ? "Bỏ quyền Trưởng nhóm" : "Đặt làm Trưởng nhóm"}
                    </button>
                  )}
                  {caps.remove && (
                    <button type="button" className="text-expense" onClick={() => setRemoving(m)}>
                      Loại khỏi dự án
                    </button>
                  )}
                </div>
              )}
            </li>
          ))}
        </ul>
        {!caps.remove && <p className="mt-2 text-[12px] text-muted">Chỉ Chủ dự án được loại thành viên hoặc đổi vai trò.</p>}
      </Section>
      <BottomSheet
        open={invite}
        onClose={() => setInvite(false)}
        title="Mời vào dự án"
        footer={
          <Button
            block
            disabled={a.pending}
            onClick={() =>
              a.run(
                () => inviteMemberAction(projectId, form),
                () => {
                  setInvite(false);
                  setForm({ email: "", role: "member", scope: "" });
                },
              )
            }
          >
            Gửi lời mời
          </Button>
        }
      >
        <div className="space-y-3">
          <TextInput label="Email tài khoản PFC" type="email" inputMode="email" autoComplete="off" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
          <SelectInput label="Vai trò" value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value as typeof form.role })}>
            <option value="member">Thành viên</option>
            {caps.inviteMentor && <option value="lead">Trưởng nhóm</option>}
            {caps.inviteMentor && <option value="mentor">Mentor</option>}
          </SelectInput>
          {form.role === "mentor" && <TextInput label="Phạm vi hỗ trợ" value={form.scope} onChange={(e) => setForm({ ...form, scope: e.target.value })} maxLength={300} placeholder="VD: góp ý mô hình tài chính, 2 buổi/tháng" />}
          <FormError message={a.error} />
        </div>
      </BottomSheet>
      <ConfirmSheet
        open={removing !== null}
        onClose={() => setRemoving(null)}
        title={`Loại ${removing?.name ?? ""} khỏi dự án?`}
        message="Người này mất quyền vào không gian làm việc; các việc đang giao sẽ được bỏ giao. Họ không thể tự xin vào lại."
        confirmLabel="Loại khỏi dự án"
        pending={a.pending}
        error={a.error}
        onConfirm={() => removing && a.run(() => removeMemberAction(projectId, removing.memberId), () => setRemoving(null))}
      />
    </>
  );
}

// ───────────────────────── Links ─────────────────────────

type Link = { id: string; kind: LinkKind; title: string; url: string; visibility: "public" | "team" };

export function LinksManager({ projectId, links, canManage }: { projectId: string; links: Link[]; canManage: boolean }) {
  const a = useAction();
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState<{ kind: LinkKind; title: string; url: string; isPublic: boolean }>({ kind: "doc", title: "", url: "https://", isPublic: false });
  return (
    <Section
      title="Tài liệu & demo"
      action={
        canManage ? (
          <button type="button" onClick={() => setOpen(true)} className="flex items-center gap-1 text-[14px] font-semibold text-primary">
            <Plus size={16} /> Thêm
          </button>
        ) : undefined
      }
    >
      {links.length === 0 ? (
        <EmptyState icon={ExternalLink} title="Chưa có tài liệu" description="Thêm link Google Drive, Figma, GitHub hoặc bản demo (https)." />
      ) : (
        <ul className="divide-y divide-line overflow-hidden rounded-[var(--radius-card)] border border-line bg-surface">
          {links.map((l) => (
            <li key={l.id} className="flex items-center gap-2 px-4 py-3">
              <a href={l.url} target="_blank" rel="noopener noreferrer" className="min-w-0 flex-1">
                <span className="block truncate text-[15px] font-semibold text-ink">{l.title}</span>
                <span className="block text-[12px] text-muted">
                  {LINK_KINDS[l.kind]} · {l.visibility === "public" ? "Công khai" : "Chỉ nhóm"}
                </span>
              </a>
              {canManage && (
                <button type="button" aria-label={`Xóa ${l.title}`} className="grid size-10 place-items-center text-muted" disabled={a.pending} onClick={() => a.run(() => removeLinkAction(l.id))}>
                  <Trash2 size={17} />
                </button>
              )}
            </li>
          ))}
        </ul>
      )}
      <BottomSheet
        open={open}
        onClose={() => setOpen(false)}
        title="Thêm tài liệu / demo"
        footer={
          <Button
            block
            disabled={a.pending}
            onClick={() =>
              a.run(
                () => addLinkAction(projectId, { kind: form.kind, title: form.title, url: form.url, visibility: form.isPublic ? "public" : "team" }),
                () => {
                  setOpen(false);
                  setForm({ kind: "doc", title: "", url: "https://", isPublic: false });
                },
              )
            }
          >
            Lưu
          </Button>
        }
      >
        <div className="space-y-3">
          <SelectInput label="Loại" value={form.kind} onChange={(e) => setForm({ ...form, kind: e.target.value as LinkKind })}>
            {Object.entries(LINK_KINDS).map(([k, label]) => (
              <option key={k} value={k}>
                {label}
              </option>
            ))}
          </SelectInput>
          <TextInput label="Tên" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} maxLength={100} />
          <TextInput label="Liên kết (https://…)" type="url" inputMode="url" value={form.url} onChange={(e) => setForm({ ...form, url: e.target.value })} maxLength={500} />
          <Toggle label="Công khai trên trang dự án" description="Tắt: chỉ thành viên dự án thấy" checked={form.isPublic} onChange={(b) => setForm({ ...form, isPublic: b })} />
          <FormError message={a.error} />
        </div>
      </BottomSheet>
    </Section>
  );
}


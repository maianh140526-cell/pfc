"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { useClub } from "@/modules/club/session";
import type { Priority } from "@/modules/club/types";
import { AppHeader, Button, EmptyState, SegmentedTabs } from "@/ui";
import { FormError, SelectInput, TextArea, TextInput } from "@/ui/Form";
import { ShieldAlert } from "lucide-react";
import { clubPost } from "@/modules/club/session";
import { AttachButton, AttachmentList, type UploadedFile } from "@/modules/club/ui/FileAttach";

/** FR-CLB-004 Create task: assignee, priority, deadline, team, attached documents. */
export default function NewClubTaskPage() {
  const router = useRouter();
  const { home, can, act } = useClub();
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [priority, setPriority] = useState<Priority>("medium");
  const [deadline, setDeadline] = useState("");
  const [assigneeId, setAssigneeId] = useState("");
  const [teamId, setTeamId] = useState(home.myMembership?.teamId ?? "");
  const [files, setFiles] = useState<UploadedFile[]>([]);
  const [state, setState] = useState<{ pending?: boolean; error?: string }>({});

  if (!(home.taskScope?.canManageTasks ?? can("manage_tasks"))) {
    return (
      <>
        <AppHeader back backFallback="/club/tasks" title="Tạo công việc" />
        <EmptyState icon={ShieldAlert} title="Bạn chưa có quyền giao việc" description="Chỉ Ban điều hành và trưởng ban được tạo công việc." />
      </>
    );
  }
  const activeMembers = home.members.filter((m) => m.status === "active");

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (title.trim().length < 3) return setState({ error: "Tên công việc tối thiểu 3 ký tự." });
    setState({ pending: true });
    try {
      const r = await act<{ taskId?: string }>("create_task", {
        title: title.trim(),
        description: description.trim() || undefined,
        priority,
        deadline: deadline ? new Date(`${deadline}T17:00:00+07:00`).toISOString() : undefined,
        assigneeId: assigneeId || undefined,
        teamId: teamId || undefined,
      });
      if (r.taskId) for (const f of files) await clubPost("add_task_attachment", { taskId: r.taskId, ...f });
      router.replace(r.taskId ? `/club/tasks/${r.taskId}` : "/club/tasks");
    } catch (err) {
      setState({ error: err instanceof Error ? err.message : "Tạo công việc thất bại." });
    }
  }

  return (
    <>
      <AppHeader back backFallback="/club/tasks" title="Tạo công việc" />
      <form onSubmit={submit} className="space-y-4 px-4 pt-2" noValidate>
        <TextInput label="Tên công việc" value={title} onChange={(e) => setTitle(e.target.value)} maxLength={160} />
        <TextArea label="Mô tả" value={description} onChange={(e) => setDescription(e.target.value)} maxLength={4000} rows={4} />
        <div>
          <p className="mb-1.5 text-[13px] font-semibold text-ink-2">Mức ưu tiên</p>
          <SegmentedTabs
            label="Mức ưu tiên"
            stretch
            value={priority}
            onChange={setPriority}
            options={[
              { value: "low", label: "Thấp" },
              { value: "medium", label: "Trung bình" },
              { value: "high", label: "Cao" },
            ]}
          />
        </div>
        <TextInput label="Hạn chót" type="date" value={deadline} onChange={(e) => setDeadline(e.target.value)} />
        <SelectInput label="Giao cho" value={assigneeId} onChange={(e) => setAssigneeId(e.target.value)}>
          <option value="">Chưa giao</option>
          {activeMembers.map((m) => (
            <option key={m.memberId} value={m.memberId}>
              {m.fullName}
              {m.teamName ? ` · ${m.teamName}` : ""}
            </option>
          ))}
        </SelectInput>
        <SelectInput label="Ban phụ trách" value={teamId} onChange={(e) => setTeamId(e.target.value)}>
          <option value="">Không thuộc ban</option>
          {home.teams.map((t) => (
            <option key={t.id} value={t.id}>
              {t.name}
            </option>
          ))}
        </SelectInput>
        <div className="space-y-2">
          <p className="text-[13px] font-semibold text-ink-2">Tài liệu đính kèm</p>
          <AttachmentList items={files} onRemove={(i) => setFiles(files.filter((_, j) => j !== i))} />
          <AttachButton disabled={files.length >= 10} onUploaded={(f) => setFiles((x) => [...x, f])} />
        </div>
        <FormError message={state.error} />
        <Button type="submit" block disabled={state.pending}>
          {state.pending ? "Đang tạo…" : "Tạo công việc"}
        </Button>
      </form>
    </>
  );
}

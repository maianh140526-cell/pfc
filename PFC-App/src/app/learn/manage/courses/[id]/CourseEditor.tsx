"use client";

import { useRouter } from "next/navigation";
import { ArrowDown, ArrowUp, FileText, Pencil, PlayCircle, Plus, Trash2 } from "lucide-react";
import { useState } from "react";
import {
  addLessonAction,
  deleteContentAction,
  deleteLessonAction,
  moveLessonAction,
  transitionAction,
  updateCourseAction,
  updateLessonAction,
} from "@/modules/education/server/actions";
import type { ContentStatus } from "@/platform/workflow";
import { BottomSheet, Button, Section, SegmentedTabs } from "@/ui";
import { FormError, TextArea, TextInput } from "@/ui/Form";
import { WorkflowBar } from "@/ui/WorkflowBar";
import { useAction } from "@/ui/use-action";
import { CourseForm } from "../CourseForm";

type Course = {
  id: string;
  title: string;
  summary: string;
  description: string;
  topic: "finance" | "development";
  level: "basic" | "intermediate" | "advanced";
  status: ContentStatus;
  rejectReason: string | null;
  isAuthor: boolean;
  canApprove: boolean;
  canEdit: boolean;
  canDelete: boolean;
};
type LessonInput = { id?: string; title: string; kind: "video" | "reading"; videoUrl: string; body: string; durationMin: number };

export function CourseEditor({ course, lessons }: { course: Course; lessons: LessonInput[] }) {
  const router = useRouter();
  const [editing, setEditing] = useState<LessonInput | null>(null);
  const lessonAct = useAction();
  const rowAct = useAction();
  const refresh = () => router.refresh();

  return (
    <>
      <Section>
        <WorkflowBar
          status={course.status}
          isAuthor={course.isAuthor}
          canApprove={course.canApprove}
          rejectReason={course.rejectReason}
          canDelete={course.canDelete}
          onAction={async (a, r) => {
            const res = await transitionAction("course", course.id, a, r);
            if (res.ok) refresh();
            return res.ok ? { ok: true } : res;
          }}
          onDelete={async () => {
            const res = await deleteContentAction("course", course.id);
            if (res.ok) router.replace("/learn/manage");
            return res.ok ? { ok: true } : res;
          }}
        />
      </Section>

      <Section title="Thông tin khóa học">
        <div className="-mx-4">
          <CourseForm
            initial={course}
            submitLabel="Lưu thông tin"
            disabled={!course.canEdit}
            onSubmit={(v) => updateCourseAction(course.id, v)}
            onDone={refresh}
          />
        </div>
      </Section>

      <Section
        title={`Bài học (${lessons.length})`}
        action={
          course.canEdit && (
            <button type="button" className="flex items-center gap-1 text-[14px] font-semibold text-primary" onClick={() => setEditing({ title: "", kind: "video", videoUrl: "", body: "", durationMin: 5 })}>
              <Plus size={16} /> Thêm bài
            </button>
          )
        }
      >
        {!course.canEdit && <p className="mb-2 text-[13px] text-muted">Khóa học đang chờ duyệt hoặc đã xuất bản: chỉ người duyệt được sửa.</p>}
        {lessons.length === 0 ? (
          <p className="text-[14px] text-muted">Chưa có bài học. Khóa học cần ít nhất một bài để gửi duyệt.</p>
        ) : (
          <ol className="divide-y divide-line overflow-hidden rounded-[var(--radius-card)] border border-line bg-surface">
            {lessons.map((l, i) => (
              <li key={l.id} className="flex items-center gap-2 px-3 py-2.5">
                {l.kind === "video" ? <PlayCircle size={18} className="shrink-0 text-primary" /> : <FileText size={18} className="shrink-0 text-primary" />}
                <span className="min-w-0 flex-1 truncate text-[14px] font-semibold text-ink">
                  {i + 1}. {l.title}
                </span>
                {course.canEdit && (
                  <span className="flex shrink-0 items-center">
                    <button type="button" aria-label="Lên" disabled={i === 0 || rowAct.pending} onClick={() => rowAct.run(() => moveLessonAction(l.id!, -1))} className="grid size-9 place-items-center text-muted disabled:opacity-30">
                      <ArrowUp size={16} />
                    </button>
                    <button type="button" aria-label="Xuống" disabled={i === lessons.length - 1 || rowAct.pending} onClick={() => rowAct.run(() => moveLessonAction(l.id!, 1))} className="grid size-9 place-items-center text-muted disabled:opacity-30">
                      <ArrowDown size={16} />
                    </button>
                    <button type="button" aria-label="Sửa" onClick={() => setEditing(l)} className="grid size-9 place-items-center text-primary">
                      <Pencil size={16} />
                    </button>
                    <button type="button" aria-label="Xóa" disabled={rowAct.pending} onClick={() => rowAct.run(() => deleteLessonAction(l.id!))} className="grid size-9 place-items-center text-expense">
                      <Trash2 size={16} />
                    </button>
                  </span>
                )}
              </li>
            ))}
          </ol>
        )}
        <div className="mt-2">
          <FormError message={rowAct.error} />
        </div>
      </Section>

      <BottomSheet
        open={editing !== null}
        onClose={() => setEditing(null)}
        title={editing?.id ? "Sửa bài học" : "Bài học mới"}
        footer={
          <Button
            block
            disabled={lessonAct.pending}
            onClick={() => {
              if (!editing) return;
              const payload = { title: editing.title, kind: editing.kind, videoUrl: editing.videoUrl, body: editing.body, durationMin: editing.durationMin };
              const id = editing.id;
              if (id) lessonAct.run(() => updateLessonAction(id, payload), () => setEditing(null));
              else lessonAct.run(() => addLessonAction(course.id, payload), () => setEditing(null));
            }}
          >
            {lessonAct.pending ? "Đang lưu…" : "Lưu bài học"}
          </Button>
        }
      >
        {editing && (
          <div className="space-y-4">
            <SegmentedTabs
              label="Loại bài"
              stretch
              value={editing.kind}
              onChange={(k) => setEditing({ ...editing, kind: k })}
              options={[
                { value: "video", label: "Video" },
                { value: "reading", label: "Bài đọc" },
              ]}
            />
            <TextInput label="Tên bài học" value={editing.title} onChange={(e) => setEditing({ ...editing, title: e.target.value })} maxLength={160} />
            {editing.kind === "video" && (
              <TextInput
                label="Link video (YouTube hoặc Vimeo)"
                type="url"
                inputMode="url"
                placeholder="https://youtu.be/…"
                value={editing.videoUrl}
                onChange={(e) => setEditing({ ...editing, videoUrl: e.target.value })}
              />
            )}
            <TextArea
              label={editing.kind === "video" ? "Ghi chú / nội dung chính (không bắt buộc)" : "Nội dung bài đọc"}
              value={editing.body}
              onChange={(e) => setEditing({ ...editing, body: e.target.value })}
              rows={6}
              maxLength={20000}
            />
            <TextInput
              label="Thời lượng (phút)"
              type="number"
              inputMode="numeric"
              min={1}
              max={240}
              value={String(editing.durationMin)}
              onChange={(e) => setEditing({ ...editing, durationMin: Number(e.target.value) || 1 })}
            />
            <FormError message={lessonAct.error} />
          </div>
        )}
      </BottomSheet>
    </>
  );
}

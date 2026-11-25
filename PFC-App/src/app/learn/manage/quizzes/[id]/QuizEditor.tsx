"use client";

import { useRouter } from "next/navigation";
import { CheckCircle2, Circle, Pencil, Plus, Trash2, X } from "lucide-react";
import { useState } from "react";
import { deleteContentAction, deleteQuestionAction, saveQuestionAction, transitionAction, updateQuizAction } from "@/modules/education/server/actions";
import type { ContentStatus } from "@/platform/workflow";
import { BottomSheet, Button, Section } from "@/ui";
import { AttachmentPicker, type AttachmentValue } from "@/ui/AttachmentPicker";
import { FormError, SelectInput, TextArea, TextInput } from "@/ui/Form";
import { WorkflowBar } from "@/ui/WorkflowBar";
import { useAction } from "@/ui/use-action";
import { cx } from "@/ui/cx";

type Q = { id?: string; prompt: string; options: string[]; correctIndex: number; explanation: string; difficulty: string };
type Quiz = {
  id: string;
  title: string;
  description: string;
  topic: string;
  subject: string;
  attachments: { url: string; name: string }[];
  passPct: number;
  timeLimitMin: number | null;
  status: ContentStatus;
  rejectReason: string | null;
  canEdit: boolean;
  canApprove: boolean;
  isAuthor: boolean;
  questions: Q[];
};

export function QuizEditor({ quiz }: { quiz: Quiz }) {
  const router = useRouter();
  const [info, setInfo] = useState({ title: quiz.title, description: quiz.description, topic: quiz.topic, subject: quiz.subject, passPct: String(quiz.passPct), timeLimitMin: quiz.timeLimitMin ? String(quiz.timeLimitMin) : "" });
  const [files, setFiles] = useState<AttachmentValue[]>(quiz.attachments.map((a) => ({ url: a.url, name: a.name })));
  const [editing, setEditing] = useState<Q | null>(null);
  const infoAct = useAction();
  const qAct = useAction();
  const rowAct = useAction();

  return (
    <>
      <Section>
        <WorkflowBar
          status={quiz.status}
          isAuthor={quiz.isAuthor}
          canApprove={quiz.canApprove}
          rejectReason={quiz.rejectReason}
          canDelete={quiz.isAuthor && (quiz.status === "draft" || quiz.status === "rejected")}
          onAction={async (a, r) => {
            const res = await transitionAction("quiz", quiz.id, a, r);
            if (res.ok) router.refresh();
            return res.ok ? { ok: true } : res;
          }}
          onDelete={async () => {
            const res = await deleteContentAction("quiz", quiz.id);
            if (res.ok) router.replace("/learn/manage");
            return res.ok ? { ok: true } : res;
          }}
        />
      </Section>

      <Section title="Thông tin">
        <fieldset disabled={!quiz.canEdit} className="space-y-3">
          <TextInput label="Tên bài kiểm tra" value={info.title} onChange={(e) => setInfo({ ...info, title: e.target.value })} />
          <TextArea label="Mô tả" value={info.description} onChange={(e) => setInfo({ ...info, description: e.target.value })} maxLength={1000} />
          <div className="grid grid-cols-2 gap-3">
            <SelectInput label="Chủ đề" value={info.topic} onChange={(e) => setInfo({ ...info, topic: e.target.value })}>
              <option value="finance">Tài chính</option>
              <option value="development">Phát triển bản thân</option>
            </SelectInput>
            <TextInput label="Điểm đạt (%)" type="number" inputMode="numeric" value={info.passPct} onChange={(e) => setInfo({ ...info, passPct: e.target.value })} />
          </div>
          <TextInput label="Môn" hint="vd: Kinh tế vi mô, Toán cao cấp" value={info.subject} onChange={(e) => setInfo({ ...info, subject: e.target.value })} maxLength={80} />
          <AttachmentPicker label="Tài liệu ôn tập kèm theo" value={files} onChange={setFiles} hint="Người làm bài tải được tài liệu này trước khi thi: đề cương, bài tập, ảnh chụp, PDF, Word…" />
          <TextInput label="Thời gian làm bài (phút)" hint="Bỏ trống = không giới hạn" inputMode="numeric" value={info.timeLimitMin} onChange={(e) => setInfo({ ...info, timeLimitMin: e.target.value.replace(/\D/g, "") })} />
          <FormError message={infoAct.error} />
          {quiz.canEdit && (
            <Button variant="secondary" block disabled={infoAct.pending} onClick={() => infoAct.run(() => updateQuizAction(quiz.id, { ...info, attachments: files, passPct: Number(info.passPct), timeLimitMin: info.timeLimitMin ? Number(info.timeLimitMin) : null }))}>
              {infoAct.pending ? "Đang lưu…" : "Lưu thông tin"}
            </Button>
          )}
        </fieldset>
      </Section>

      <Section
        title={`Câu hỏi (${quiz.questions.length})`}
        action={
          quiz.canEdit && (
            <button
              type="button"
              className="flex items-center gap-1 text-[14px] font-semibold text-primary"
              onClick={() => setEditing({ prompt: "", options: ["", "", "", ""], correctIndex: 0, explanation: "", difficulty: "basic" })}
            >
              <Plus size={16} /> Thêm câu
            </button>
          )
        }
      >
        {quiz.questions.length === 0 ? (
          <p className="text-[14px] text-muted">Chưa có câu hỏi. Cần ít nhất một câu để gửi duyệt.</p>
        ) : (
          <ol className="space-y-3">
            {quiz.questions.map((q, i) => (
              <li key={q.id} className="rounded-[var(--radius-card)] border border-line bg-surface p-3.5">
                <div className="flex items-start gap-2">
                  <p className="flex-1 text-[15px] font-semibold text-ink">
                    {i + 1}. {q.prompt}
                  </p>
                  {quiz.canEdit && (
                    <>
                      <button type="button" aria-label="Sửa câu hỏi" onClick={() => setEditing(q)} className="grid size-8 place-items-center text-primary">
                        <Pencil size={16} />
                      </button>
                      <button type="button" aria-label="Xóa câu hỏi" disabled={rowAct.pending} onClick={() => rowAct.run(() => deleteQuestionAction(quiz.id, q.id!))} className="grid size-8 place-items-center text-expense">
                        <Trash2 size={16} />
                      </button>
                    </>
                  )}
                </div>
                <ul className="mt-2 space-y-1 text-[14px]">
                  {q.options.map((o, idx) => (
                    <li key={idx} className={cx("flex items-center gap-2", idx === q.correctIndex ? "font-semibold text-income" : "text-ink-2")}>
                      {idx === q.correctIndex ? <CheckCircle2 size={15} /> : <Circle size={15} className="text-line" />} {o}
                    </li>
                  ))}
                </ul>
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
        title={editing?.id ? "Sửa câu hỏi" : "Câu hỏi mới"}
        footer={
          <Button
            block
            disabled={qAct.pending}
            onClick={() => {
              if (!editing) return;
              const payload = { prompt: editing.prompt, options: editing.options, correctIndex: editing.correctIndex, explanation: editing.explanation, difficulty: editing.difficulty };
              qAct.run(() => saveQuestionAction(quiz.id, editing.id ?? null, payload), () => setEditing(null));
            }}
          >
            {qAct.pending ? "Đang lưu…" : "Lưu câu hỏi"}
          </Button>
        }
      >
        {editing && (
          <div className="space-y-4">
            <TextArea label="Câu hỏi" value={editing.prompt} onChange={(e) => setEditing({ ...editing, prompt: e.target.value })} maxLength={500} />
            <div>
              <p className="mb-1.5 text-[13px] font-semibold text-ink-2">Đáp án (chạm vòng tròn để chọn đáp án đúng)</p>
              <div className="space-y-2">
                {editing.options.map((o, idx) => (
                  <div key={idx} className="flex items-center gap-2">
                    <button
                      type="button"
                      aria-label={`Chọn đáp án ${String.fromCharCode(65 + idx)} là đúng`}
                      aria-pressed={editing.correctIndex === idx}
                      onClick={() => setEditing({ ...editing, correctIndex: idx })}
                      className={editing.correctIndex === idx ? "text-income" : "text-line"}
                    >
                      {editing.correctIndex === idx ? <CheckCircle2 size={24} /> : <Circle size={24} />}
                    </button>
                    <input
                      value={o}
                      onChange={(e) => setEditing({ ...editing, options: editing.options.map((x, j) => (j === idx ? e.target.value : x)) })}
                      placeholder={`Đáp án ${String.fromCharCode(65 + idx)}`}
                      aria-label={`Đáp án ${String.fromCharCode(65 + idx)}`}
                      maxLength={200}
                      className="min-h-11 min-w-0 flex-1 rounded-xl border border-line bg-surface px-3 text-[16px] text-ink outline-none focus:border-primary"
                    />
                    {editing.options.length > 2 && (
                      <button
                        type="button"
                        aria-label="Bỏ đáp án"
                        onClick={() =>
                          setEditing({
                            ...editing,
                            options: editing.options.filter((_, j) => j !== idx),
                            correctIndex: editing.correctIndex === idx ? 0 : editing.correctIndex > idx ? editing.correctIndex - 1 : editing.correctIndex,
                          })
                        }
                        className="text-muted"
                      >
                        <X size={18} />
                      </button>
                    )}
                  </div>
                ))}
              </div>
              {editing.options.length < 6 && (
                <button type="button" className="mt-2 text-[14px] font-semibold text-primary" onClick={() => setEditing({ ...editing, options: [...editing.options, ""] })}>
                  + Thêm đáp án
                </button>
              )}
            </div>
            <TextArea label="Giải thích (hiện sau khi nộp bài)" value={editing.explanation} onChange={(e) => setEditing({ ...editing, explanation: e.target.value })} maxLength={1000} />
            <SelectInput label="Độ khó" value={editing.difficulty} onChange={(e) => setEditing({ ...editing, difficulty: e.target.value })}>
              <option value="basic">Dễ</option>
              <option value="intermediate">Trung bình</option>
              <option value="advanced">Khó</option>
            </SelectInput>
            <FormError message={qAct.error} />
          </div>
        )}
      </BottomSheet>
    </>
  );
}

"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { deleteContentAction, saveResourceAction, transitionAction } from "@/modules/education/server/actions";
import type { ContentStatus } from "@/platform/workflow";
import { Button, Section } from "@/ui";
import { FormError, SelectInput, TextArea, TextInput } from "@/ui/Form";
import { AttachmentPicker, type AttachmentValue } from "@/ui/AttachmentPicker";
import { WorkflowBar } from "@/ui/WorkflowBar";
import { useAction } from "@/ui/use-action";

type R = { id?: string; title: string; kind: string; topic: string; subject: string; url: string; description: string; quizId: string | null; attachments?: { url: string; name: string }[]; status?: ContentStatus; rejectReason?: string | null; canEdit?: boolean; canApprove?: boolean; isAuthor?: boolean };

/** EDU-A01 resource editor: documents, exercises and notes by subject, with photos / files attached and an optional quiz. */
export function ResourceForm({ initial, quizzes = [] }: { initial?: R; quizzes?: { id: string; title: string }[] }) {
  const router = useRouter();
  const [v, setV] = useState<R>(initial ?? { title: "", kind: "exercise", topic: "finance", subject: "", url: "", description: "", quizId: null });
  const [files, setFiles] = useState<AttachmentValue[]>((initial?.attachments ?? []).map((a) => ({ url: a.url, name: a.name })));
  const { run, pending, error } = useAction();
  const editable = !initial || initial.canEdit;
  const set = (k: keyof R) => (e: { target: { value: string } }) => setV((x) => ({ ...x, [k]: e.target.value }));

  return (
    <>
      {initial?.id && initial.status && (
        <Section>
          <WorkflowBar
            status={initial.status}
            isAuthor={!!initial.isAuthor}
            canApprove={!!initial.canApprove}
            rejectReason={initial.rejectReason}
            canDelete={!!initial.isAuthor && (initial.status === "draft" || initial.status === "rejected")}
            onAction={async (a, r) => {
              const res = await transitionAction("resource", initial.id!, a, r);
              if (res.ok) router.refresh();
              return res.ok ? { ok: true } : res;
            }}
            onDelete={async () => {
              const res = await deleteContentAction("resource", initial.id!);
              if (res.ok) router.replace("/learn/manage");
              return res.ok ? { ok: true } : res;
            }}
          />
        </Section>
      )}
      <form
        className="space-y-4 px-4 pt-4"
        noValidate
        onSubmit={(e) => {
          e.preventDefault();
          run(
            () => saveResourceAction(initial?.id ?? null, { title: v.title, kind: v.kind, topic: v.topic, subject: v.subject, url: v.url, description: v.description, quizId: v.quizId || null, attachments: files }),
            (id) => (initial?.id ? router.refresh() : router.replace(`/learn/manage/resources/${id}`)),
          );
        }}
      >
        <fieldset disabled={!editable} className="space-y-4">
          <TextInput label="Tên tài liệu" value={v.title} onChange={set("title")} maxLength={160} />
          <div className="grid grid-cols-2 gap-3">
            <SelectInput label="Loại" value={v.kind} onChange={set("kind")}>
              <option value="exercise">Bài tập</option>
              <option value="notes">Ghi chú / bài giảng</option>
              <option value="exam">Đề kiểm tra</option>
              <option value="ebook">eBook</option>
              <option value="template">Template</option>
              <option value="checklist">Checklist</option>
              <option value="article">Bài viết</option>
            </SelectInput>
            <SelectInput label="Chủ đề" value={v.topic} onChange={set("topic")}>
              <option value="finance">Tài chính</option>
              <option value="development">Phát triển bản thân</option>
            </SelectInput>
          </div>
          <TextInput label="Môn học" hint="vd: Kinh tế vi mô, Toán cao cấp, Tài chính doanh nghiệp" value={v.subject} onChange={set("subject")} maxLength={80} />
          <AttachmentPicker value={files} onChange={setFiles} />
          <TextInput label="Hoặc dán link tài liệu (https)" type="url" inputMode="url" placeholder="https://drive.google.com/…" value={v.url} onChange={set("url")} />
          <p className="-mt-2 text-[12px] text-muted">Tệp lớn hơn 4 MB: để ở Google Drive, Notion… và bật quyền xem cho mọi người có link.</p>
          <SelectInput label="Gắn bài kiểm tra" value={v.quizId ?? ""} onChange={(e) => setV((x) => ({ ...x, quizId: e.target.value || null }))}>
            <option value="">— Không gắn —</option>
            {quizzes.map((q) => (
              <option key={q.id} value={q.id}>
                {q.title}
              </option>
            ))}
          </SelectInput>
          <TextArea label="Mô tả" value={v.description} onChange={set("description")} maxLength={1000} />
          <p className="text-[12px] text-muted">Chỉ đăng tài liệu bạn có quyền chia sẻ. Tài liệu được Ban Chuyên môn duyệt trước khi hiện công khai.</p>
          <FormError message={error} />
          <Button type="submit" block disabled={pending}>
            {pending ? "Đang lưu…" : initial?.id ? "Lưu thay đổi" : "Tạo tài liệu"}
          </Button>
        </fieldset>
      </form>
    </>
  );
}

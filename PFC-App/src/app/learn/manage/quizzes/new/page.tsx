"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { createQuizAction } from "@/modules/education/server/actions";
import { AppHeader, Button } from "@/ui";
import { AttachmentPicker, type AttachmentValue } from "@/ui/AttachmentPicker";
import { FormError, SelectInput, TextArea, TextInput } from "@/ui/Form";
import { useAction } from "@/ui/use-action";

/** EDU-A05 Quiz/Test Management — create. */
export default function NewQuizPage() {
  const router = useRouter();
  const [v, setV] = useState({ title: "", description: "", topic: "finance", subject: "", passPct: "70", timeLimitMin: "" });
  const [files, setFiles] = useState<AttachmentValue[]>([]);
  const { run, pending, error } = useAction();
  const set = (k: keyof typeof v) => (e: { target: { value: string } }) => setV((x) => ({ ...x, [k]: e.target.value }));
  return (
    <>
      <AppHeader back backFallback="/learn/manage" title="Bài kiểm tra mới" />
      <form
        className="space-y-4 px-4 pt-2"
        noValidate
        onSubmit={(e) => {
          e.preventDefault();
          run(() => createQuizAction({ ...v, attachments: files, passPct: Number(v.passPct), timeLimitMin: v.timeLimitMin ? Number(v.timeLimitMin) : null }), (id) => router.replace(`/learn/manage/quizzes/${id}`));
        }}
      >
        <TextInput label="Tên bài kiểm tra" value={v.title} onChange={set("title")} maxLength={120} />
        <TextArea label="Mô tả" value={v.description} onChange={set("description")} maxLength={1000} />
        <TextInput label="Môn" hint="vd: Kinh tế vi mô, Toán cao cấp" value={v.subject} onChange={set("subject")} maxLength={80} />
        <AttachmentPicker label="Tài liệu ôn tập kèm theo" value={files} onChange={setFiles} hint="Người làm bài tải được tài liệu này trước khi thi: đề cương, bài tập, ảnh chụp, PDF, Word…" />
        <div className="grid grid-cols-2 gap-3">
          <SelectInput label="Chủ đề" value={v.topic} onChange={set("topic")}>
            <option value="finance">Tài chính</option>
            <option value="development">Phát triển bản thân</option>
          </SelectInput>
          <TextInput label="Điểm đạt (%)" type="number" inputMode="numeric" min={1} max={100} value={v.passPct} onChange={set("passPct")} />
        </div>
        <TextInput label="Thời gian làm bài (phút)" hint="Bỏ trống = không giới hạn" inputMode="numeric" value={v.timeLimitMin} onChange={(e) => setV((x) => ({ ...x, timeLimitMin: e.target.value.replace(/\D/g, "") }))} />
        <FormError message={error} />
        <Button type="submit" block disabled={pending}>
          {pending ? "Đang tạo…" : "Tạo và thêm câu hỏi"}
        </Button>
      </form>
    </>
  );
}

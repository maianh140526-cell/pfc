"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { createThreadAction } from "@/modules/education/server/actions";
import { AppHeader, Button } from "@/ui";
import { FormError, SelectInput, TextArea, TextInput } from "@/ui/Form";
import { useAction } from "@/ui/use-action";

/** EDU-18 Create Discussion (mockup 142). */
export default function NewThreadPage() {
  const router = useRouter();
  const [topic, setTopic] = useState("finance");
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const { run, pending, error } = useAction();
  return (
    <>
      <AppHeader back backFallback="/learn/forum" title="Tạo bài thảo luận" />
      <form
        className="space-y-4 px-4 pt-2"
        noValidate
        onSubmit={(e) => {
          e.preventDefault();
          run(() => createThreadAction({ topic, title, body }), (id) => router.replace(`/learn/forum/${id}`));
        }}
      >
        <SelectInput label="Chủ đề" value={topic} onChange={(e) => setTopic(e.target.value)}>
          <option value="finance">Tài chính</option>
          <option value="development">Phát triển bản thân</option>
          <option value="career">Sự nghiệp</option>
          <option value="question">Hỏi đáp</option>
        </SelectInput>
        <TextInput label="Tiêu đề" value={title} onChange={(e) => setTitle(e.target.value)} maxLength={160} />
        <TextArea label="Nội dung" value={body} onChange={(e) => setBody(e.target.value)} maxLength={10000} rows={7} placeholder="Chia sẻ suy nghĩ, câu hỏi hoặc kinh nghiệm của bạn…" />
        <p className="text-[12px] text-muted">Bài viết cần tôn trọng quy tắc cộng đồng. Ban Truyền thông có thể ẩn bài vi phạm.</p>
        <FormError message={error} />
        <Button type="submit" block disabled={pending}>
          {pending ? "Đang đăng…" : "Đăng bài"}
        </Button>
      </form>
    </>
  );
}

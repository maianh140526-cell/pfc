"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { PROJECT_CATEGORIES } from "../domain/projects";
import { createProjectAction, updateProjectAction } from "../server/actions";
import { Button } from "@/ui";
import { FormError, SelectInput, TextArea, TextInput, Toggle } from "@/ui/Form";
import { useAction } from "@/ui/use-action";

type V = { title: string; summary: string; description: string; category: string; skills: string; recruiting: boolean };

/** PRO-05 Create Project / PRO-06 Edit Project (FR-PROJ-001: title, description, category, status, owner). */
export function ProjectForm({ id, initial }: { id?: string; initial?: V }) {
  const router = useRouter();
  const [v, setV] = useState<V>(initial ?? { title: "", summary: "", description: "", category: "fintech", skills: "", recruiting: true });
  const { run, pending, error } = useAction();
  const set = (k: keyof V) => (e: { target: { value: string } }) => setV((x) => ({ ...x, [k]: e.target.value }));
  return (
    <form
      className="space-y-4 px-4 pt-2"
      noValidate
      onSubmit={(e) => {
        e.preventDefault();
        if (id) run(() => updateProjectAction(id, v), () => router.replace(`/projects/p/${id}`));
        else run(() => createProjectAction(v), (newId) => router.replace(`/projects/p/${newId}`));
      }}
    >
      <TextInput label="Tên dự án" value={v.title} onChange={set("title")} maxLength={120} placeholder="VD: App lập ngân sách cho sinh viên" />
      <TextInput label="Mô tả ngắn" value={v.summary} onChange={set("summary")} maxLength={200} hint="Hiển thị trên thẻ dự án (tối đa 200 ký tự)." />
      <SelectInput label="Lĩnh vực" value={v.category} onChange={set("category")}>
        {Object.entries(PROJECT_CATEGORIES).map(([k, label]) => (
          <option key={k} value={k}>
            {label}
          </option>
        ))}
      </SelectInput>
      <TextArea label="Giới thiệu chi tiết" value={v.description} onChange={set("description")} maxLength={8000} rows={6} placeholder="Vấn đề, giải pháp, mục tiêu, kế hoạch, bạn cần ai…" />
      <TextInput label="Kỹ năng cần (phân cách bằng dấu phẩy)" value={v.skills} onChange={set("skills")} maxLength={400} placeholder="React, Phân tích tài chính, Thiết kế" />
      <Toggle label="Đang tuyển thành viên" description="Người khác có thể gửi yêu cầu tham gia" checked={v.recruiting} onChange={(b) => setV({ ...v, recruiting: b })} />
      <FormError message={error} />
      <Button type="submit" block disabled={pending}>
        {pending ? "Đang lưu…" : id ? "Lưu thay đổi" : "Tạo bản nháp"}
      </Button>
      {!id && <p className="text-center text-[12px] text-muted">Bản nháp chỉ bạn thấy. Sau đó gửi duyệt để công khai.</p>}
    </form>
  );
}

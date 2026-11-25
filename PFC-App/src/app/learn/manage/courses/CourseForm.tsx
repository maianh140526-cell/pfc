"use client";

import { useState } from "react";
import { Button } from "@/ui";
import { FormError, SelectInput, TextArea, TextInput } from "@/ui/Form";
import { useAction } from "@/ui/use-action";

type Values = { title: string; summary: string; description: string; topic: "finance" | "development"; level: "basic" | "intermediate" | "advanced" };
type Res<T> = { ok: true; data: T } | { ok: false; error: string };

export function CourseForm<T>({
  initial,
  submitLabel,
  onSubmit,
  onDone,
  disabled,
}: {
  initial?: Values;
  submitLabel: string;
  onSubmit: (v: Values) => Promise<Res<T>>;
  onDone?: (data: T) => void;
  disabled?: boolean;
}) {
  const [v, setV] = useState<Values>(initial ?? { title: "", summary: "", description: "", topic: "finance", level: "basic" });
  const { run, pending, error } = useAction();
  const set = (k: keyof Values) => (e: { target: { value: string } }) => setV((x) => ({ ...x, [k]: e.target.value }));
  return (
    <form
      className="space-y-4 px-4 pt-2"
      noValidate
      onSubmit={(e) => {
        e.preventDefault();
        run(() => onSubmit(v), onDone);
      }}
    >
      <fieldset disabled={disabled} className="space-y-4">
        <TextInput label="Tên khóa học" value={v.title} onChange={set("title")} maxLength={120} />
        <TextInput label="Tóm tắt ngắn" value={v.summary} onChange={set("summary")} maxLength={200} />
        <TextArea label="Giới thiệu khóa học" value={v.description} onChange={set("description")} maxLength={5000} rows={4} />
        <div className="grid grid-cols-2 gap-3">
          <SelectInput label="Chủ đề" value={v.topic} onChange={set("topic")}>
            <option value="finance">Tài chính cá nhân</option>
            <option value="development">Phát triển bản thân</option>
          </SelectInput>
          <SelectInput label="Trình độ" value={v.level} onChange={set("level")}>
            <option value="basic">Cơ bản</option>
            <option value="intermediate">Trung cấp</option>
            <option value="advanced">Nâng cao</option>
          </SelectInput>
        </div>
        <FormError message={error} />
        <Button type="submit" block disabled={pending || disabled}>
          {pending ? "Đang lưu…" : submitLabel}
        </Button>
      </fieldset>
    </form>
  );
}

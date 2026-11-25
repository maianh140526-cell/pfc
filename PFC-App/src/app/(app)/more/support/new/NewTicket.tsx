"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { createTicketAction } from "@/platform/admin/console-actions";
import { Button } from "@/ui";
import { FormError, SelectInput, TextArea, TextInput } from "@/ui/Form";
import { useAction } from "@/ui/use-action";

export function NewTicket({ categories }: { categories: [string, string][] }) {
  const router = useRouter();
  const a = useAction();
  const [v, setV] = useState({ category: categories[0][0], subject: "", body: "" });
  return (
    <form
      className="space-y-4 px-4 pt-2 pb-6"
      noValidate
      onSubmit={(e) => {
        e.preventDefault();
        a.run(() => createTicketAction(v), (id) => router.replace(`/more/support/${id}`));
      }}
    >
      <SelectInput label="Chủ đề" value={v.category} onChange={(e) => setV({ ...v, category: e.target.value })}>
        {categories.map(([k, l]) => (
          <option key={k} value={k}>
            {l}
          </option>
        ))}
      </SelectInput>
      <TextInput label="Tiêu đề" value={v.subject} onChange={(e) => setV({ ...v, subject: e.target.value })} maxLength={120} />
      <TextArea label="Mô tả chi tiết" hint="Đừng gửi mật khẩu, mã OTP hay số thẻ." value={v.body} onChange={(e) => setV({ ...v, body: e.target.value })} maxLength={4000} />
      <FormError message={a.error} />
      <Button type="submit" block disabled={a.pending}>
        {a.pending ? "Đang gửi…" : "Gửi yêu cầu"}
      </Button>
    </form>
  );
}

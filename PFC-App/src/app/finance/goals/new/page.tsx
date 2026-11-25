"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { createGoalAction } from "@/modules/finance/server/actions";
import { AmountInput, AppHeader, Button } from "@/ui";
import { FormError, TextInput } from "@/ui/Form";
import { useAction } from "@/ui/use-action";

/** FIN-14 Create Saving Goal. */
export default function NewGoalPage() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [target, setTarget] = useState("");
  const [current, setCurrent] = useState("");
  const [deadline, setDeadline] = useState("");
  const { run, pending, error } = useAction();

  return (
    <>
      <AppHeader back backFallback="/finance/goals" title="Mục tiêu mới" />
      <form
        className="space-y-4 px-4 pt-2"
        noValidate
        onSubmit={(e) => {
          e.preventDefault();
          run(
            () => createGoalAction({ name, target: Number(target), current: Number(current || 0), deadline }),
            (d) => router.replace(`/finance/goals/${d.id}`),
          );
        }}
      >
        <TextInput label="Tên mục tiêu" value={name} onChange={(e) => setName(e.target.value)} placeholder="Ví dụ: Quỹ khẩn cấp" maxLength={60} />
        <AmountInput label="Số tiền mục tiêu (VND)" value={target} onChange={setTarget} />
        <AmountInput label="Đã có sẵn (không bắt buộc)" value={current} onChange={setCurrent} />
        <TextInput label="Hạn hoàn thành" type="date" value={deadline} onChange={(e) => setDeadline(e.target.value)} />
        <FormError message={error} />
        <Button type="submit" block disabled={pending}>
          {pending ? "Đang tạo…" : "Tạo mục tiêu"}
        </Button>
      </form>
    </>
  );
}

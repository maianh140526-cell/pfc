"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { deleteBudgetAction } from "@/modules/finance/server/actions";
import { Button } from "@/ui";
import { ConfirmSheet } from "@/ui/ConfirmSheet";
import { useAction } from "@/ui/use-action";

export function DeleteBudgetButton({ id, month }: { id: string; month: string }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const { run, pending, error } = useAction();
  return (
    <>
      <Button variant="danger" onClick={() => setOpen(true)}>
        Xóa ngân sách
      </Button>
      <ConfirmSheet
        open={open}
        onClose={() => setOpen(false)}
        title="Xóa ngân sách?"
        message="Hạn mức của danh mục này trong tháng sẽ bị xóa. Các giao dịch vẫn được giữ nguyên."
        pending={pending}
        error={error}
        onConfirm={() => run(() => deleteBudgetAction(id), () => router.replace(`/finance/budgets?month=${month}`))}
      />
    </>
  );
}

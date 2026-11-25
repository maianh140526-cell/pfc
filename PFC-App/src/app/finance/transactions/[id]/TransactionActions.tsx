"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { Copy, Pencil, Trash2 } from "lucide-react";
import { useState } from "react";
import { deleteTransactionAction, duplicateTransactionAction } from "@/modules/finance/server/actions";
import { ConfirmSheet } from "@/ui/ConfirmSheet";
import { useAction } from "@/ui/use-action";

/** Mockup 30: Edit · Duplicate · Delete. */
export function TransactionActions({ id }: { id: string }) {
  const router = useRouter();
  const [confirm, setConfirm] = useState(false);
  const del = useAction();
  const dup = useAction();
  const cell = "pressable flex flex-col items-center gap-1.5 rounded-2xl border border-line bg-surface py-3 text-[13px] font-semibold";

  return (
    <>
      <div className="grid grid-cols-3 gap-3">
        <Link href={`/finance/transactions/${id}/edit`} className={`${cell} text-ink`}>
          <Pencil size={20} className="text-primary" /> Sửa
        </Link>
        <button
          type="button"
          disabled={dup.pending}
          onClick={() => dup.run(() => duplicateTransactionAction(id), (d) => router.push(`/finance/transactions/${d.id}`))}
          className={`${cell} text-ink`}
        >
          <Copy size={20} className="text-primary" /> {dup.pending ? "Đang sao…" : "Nhân bản"}
        </button>
        <button type="button" onClick={() => setConfirm(true)} className={`${cell} text-expense`}>
          <Trash2 size={20} /> Xóa
        </button>
      </div>
      {dup.error && <p className="mt-3 text-[14px] text-expense">{dup.error}</p>}
      <ConfirmSheet
        open={confirm}
        onClose={() => setConfirm(false)}
        title="Xóa giao dịch?"
        message="Giao dịch sẽ bị xóa vĩnh viễn và không thể khôi phục. Báo cáo và ngân sách sẽ được tính lại."
        pending={del.pending}
        error={del.error}
        onConfirm={() => del.run(() => deleteTransactionAction(id), () => router.replace("/finance/transactions"))}
      />
    </>
  );
}

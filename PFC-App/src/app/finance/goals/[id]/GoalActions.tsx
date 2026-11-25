"use client";

import { useRouter } from "next/navigation";
import { Minus, Plus, Trash2 } from "lucide-react";
import { useState } from "react";
import { adjustGoalAction, deleteGoalAction } from "@/modules/finance/server/actions";
import { AmountInput, BottomSheet, Button } from "@/ui";
import { ConfirmSheet } from "@/ui/ConfirmSheet";
import { FormError } from "@/ui/Form";
import { useAction } from "@/ui/use-action";

export function GoalActions({ id, current }: { id: string; current: number }) {
  const router = useRouter();
  const [mode, setMode] = useState<"add" | "withdraw" | null>(null);
  const [amount, setAmount] = useState("");
  const [confirm, setConfirm] = useState(false);
  const adjust = useAction();
  const del = useAction();

  return (
    <>
      <div className="grid grid-cols-2 gap-3">
        <Button onClick={() => setMode("add")}>
          <Plus size={18} /> Nạp thêm
        </Button>
        <Button variant="secondary" onClick={() => setMode("withdraw")} disabled={current === 0}>
          <Minus size={18} /> Rút bớt
        </Button>
      </div>
      <Button variant="ghost" block className="mt-3 text-expense" onClick={() => setConfirm(true)}>
        <Trash2 size={18} /> Xóa mục tiêu
      </Button>

      <BottomSheet
        open={mode !== null}
        onClose={() => {
          setMode(null);
          setAmount("");
        }}
        title={mode === "add" ? "Nạp tiền vào mục tiêu" : "Rút tiền khỏi mục tiêu"}
        footer={
          <Button
            block
            disabled={adjust.pending || !amount}
            onClick={() =>
              adjust.run(
                () => adjustGoalAction(id, (mode === "add" ? 1 : -1) * Number(amount)),
                () => {
                  setMode(null);
                  setAmount("");
                },
              )
            }
          >
            {adjust.pending ? "Đang lưu…" : "Xác nhận"}
          </Button>
        }
      >
        <AmountInput value={amount} onChange={setAmount} tone={mode === "add" ? "income" : "expense"} />
        <p className="mt-2 text-[13px] text-muted">
          Đây là sổ theo dõi tiến độ, PFC không giữ hay chuyển tiền của bạn.
        </p>
        <div className="mt-3">
          <FormError message={adjust.error} />
        </div>
      </BottomSheet>

      <ConfirmSheet
        open={confirm}
        onClose={() => setConfirm(false)}
        title="Xóa mục tiêu?"
        message="Mục tiêu và tiến độ sẽ bị xóa vĩnh viễn. Giao dịch thu chi không bị ảnh hưởng."
        pending={del.pending}
        error={del.error}
        onConfirm={() => del.run(() => deleteGoalAction(id), () => router.replace("/finance/goals"))}
      />
    </>
  );
}

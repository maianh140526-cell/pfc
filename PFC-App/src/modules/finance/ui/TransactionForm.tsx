"use client";

import { useRouter } from "next/navigation";
import { Check, ChevronRight } from "lucide-react";
import { useMemo, useState } from "react";
import { AmountInput, BottomSheet, Button, SegmentedTabs } from "@/ui";
import { FormError, TextArea, TextInput } from "@/ui/Form";
import { useAction } from "@/ui/use-action";
import { cx } from "@/ui/cx";
import type { TxType } from "../domain/categories";
import { createTransactionAction, updateTransactionAction } from "../server/actions";
import type { Category } from "../server/queries";
import { CategoryBadge } from "./CategoryIcon";

type Initial = { type: TxType; amount: number; categoryId: string; occurredAt: string; note: string };

/** FIN-05 Add / FIN-06 Edit transaction (mockup 22 / 28). */
export function TransactionForm({
  categories,
  initial,
  txId,
  defaultOccurredAt,
}: {
  categories: Category[];
  initial?: Initial;
  txId?: string;
  defaultOccurredAt: string;
}) {
  const router = useRouter();
  const [type, setType] = useState<TxType>(initial?.type ?? "expense");
  const [amount, setAmount] = useState(initial ? String(initial.amount) : "");
  const [categoryId, setCategoryId] = useState(initial?.categoryId ?? "");
  const [occurredAt, setOccurredAt] = useState(initial?.occurredAt ?? defaultOccurredAt);
  const [note, setNote] = useState(initial?.note ?? "");
  const [pickerOpen, setPickerOpen] = useState(false);
  const { run, pending, error, setError } = useAction();

  const options = useMemo(() => categories.filter((c) => c.type === type && (!c.archived || c.id === categoryId)), [categories, type, categoryId]);
  const selected = categories.find((c) => c.id === categoryId && c.type === type);

  function changeType(t: TxType) {
    setType(t);
    if (selected?.type !== t) setCategoryId("");
  }

  function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!amount || Number(amount) <= 0) return setError("Vui lòng nhập số tiền.");
    if (!selected) return setError("Vui lòng chọn danh mục.");
    const payload = { type, amount: Number(amount), categoryId, occurredAt, note };
    if (txId) {
      run(() => updateTransactionAction(txId, payload), () => router.replace(`/finance/transactions/${txId}`));
    } else {
      run(() => createTransactionAction(payload), () => router.replace("/finance/transactions"));
    }
  }

  return (
    <form onSubmit={submit} className="space-y-5 px-4 pt-2" noValidate>
      <SegmentedTabs
        label="Loại giao dịch"
        stretch
        value={type}
        onChange={changeType}
        options={[
          { value: "expense", label: "Chi tiêu" },
          { value: "income", label: "Thu nhập" },
        ]}
      />
      <AmountInput value={amount} onChange={setAmount} tone={type} />

      <div>
        <span className="mb-1.5 block text-[13px] font-semibold text-ink-2">Danh mục</span>
        <button
          type="button"
          onClick={() => setPickerOpen(true)}
          className="pressable flex min-h-14 w-full items-center gap-3 rounded-[var(--radius-control)] border border-line bg-surface px-3 text-left"
        >
          {selected ? (
            <>
              <CategoryBadge icon={selected.icon} type={type} size="sm" />
              <span className="flex-1 text-[16px] font-semibold text-ink">{selected.name}</span>
            </>
          ) : (
            <span className="flex-1 px-1 text-[16px] text-muted">Chọn danh mục</span>
          )}
          <ChevronRight size={18} className="text-muted" />
        </button>
      </div>

      <TextInput label="Ngày giờ" type="datetime-local" value={occurredAt} onChange={(e) => setOccurredAt(e.target.value)} required />
      <TextArea label="Ghi chú (không bắt buộc)" value={note} onChange={(e) => setNote(e.target.value)} maxLength={200} placeholder="Ví dụ: Cà phê với bạn" />

      <FormError message={error} />
      <Button type="submit" block disabled={pending}>
        {pending ? "Đang lưu…" : "Lưu giao dịch"}
      </Button>

      <BottomSheet open={pickerOpen} onClose={() => setPickerOpen(false)} title={type === "expense" ? "Danh mục chi tiêu" : "Danh mục thu nhập"}>
        <ul className="grid grid-cols-3 gap-3">
          {options.map((c) => (
            <li key={c.id}>
              <button
                type="button"
                onClick={() => {
                  setCategoryId(c.id);
                  setPickerOpen(false);
                }}
                className={cx(
                  "pressable relative flex w-full flex-col items-center gap-2 rounded-2xl border-2 p-3 text-center text-[13px] font-semibold text-ink",
                  c.id === categoryId ? "border-primary bg-primary-soft" : "border-line bg-surface",
                )}
              >
                <CategoryBadge icon={c.icon} type={type} />
                <span className="line-clamp-2">{c.name}</span>
                {c.id === categoryId && <Check size={16} className="absolute top-2 right-2 text-primary" />}
              </button>
            </li>
          ))}
        </ul>
        <p className="mt-4 text-center text-[13px] text-muted">
          Quản lý danh mục trong <b>Tiện ích → Danh mục</b>.
        </p>
      </BottomSheet>
    </form>
  );
}

"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { formatVnd } from "@/lib/money";
import { formatAmountInput, sanitizeAmountDigits } from "@/lib/money";
import { monthLabel } from "@/modules/finance/domain/dates";
import { saveBudgetsAction } from "@/modules/finance/server/actions";
import type { Category } from "@/modules/finance/server/queries";
import { CategoryBadge } from "@/modules/finance/ui/CategoryIcon";
import { Button, Card } from "@/ui";
import { FormError } from "@/ui/Form";
import { useAction } from "@/ui/use-action";

/** One row per expense category; empty rows are skipped. Existing limits are pre-filled. */
export function BudgetForm({
  month,
  categories,
  existing,
}: {
  month: string;
  categories: Category[];
  existing: Array<{ categoryId: string; limit: number }>;
}) {
  const router = useRouter();
  const [values, setValues] = useState<Record<string, string>>(
    Object.fromEntries(existing.map((e) => [e.categoryId, String(e.limit)])),
  );
  const { run, pending, error, setError } = useAction();
  const total = Object.values(values).reduce((a, v) => a + (Number(v) || 0), 0);

  function submit(e: React.FormEvent) {
    e.preventDefault();
    const lines = Object.entries(values)
      .filter(([, v]) => Number(v) > 0)
      .map(([categoryId, v]) => ({ categoryId, limit: Number(v) }));
    if (lines.length === 0) return setError("Nhập hạn mức cho ít nhất một danh mục.");
    run(() => saveBudgetsAction({ month, lines }), () => router.replace(`/finance/budgets?month=${month}`));
  }

  return (
    <form onSubmit={submit} className="space-y-4 px-4 pt-2" noValidate>
      <Card className="flex items-center justify-between">
        <div>
          <p className="text-[13px] text-muted">Kỳ ngân sách</p>
          <p className="text-[16px] font-bold text-ink">{monthLabel(month)}</p>
        </div>
        <div className="text-right">
          <p className="text-[13px] text-muted">Tổng hạn mức</p>
          <p className="text-[16px] font-bold text-primary">{formatVnd(total)}</p>
        </div>
      </Card>
      <ul className="divide-y divide-line rounded-[var(--radius-card)] border border-line bg-surface">
        {categories.map((c) => (
          <li key={c.id} className="flex items-center gap-3 px-3 py-2.5">
            <CategoryBadge icon={c.icon} type="expense" size="sm" />
            <label htmlFor={`b-${c.id}`} className="min-w-0 flex-1 truncate text-[15px] font-semibold text-ink">
              {c.name}
            </label>
            <div className="flex w-40 items-baseline gap-1 rounded-xl border border-line bg-bg px-3 py-2 focus-within:border-primary">
              <input
                id={`b-${c.id}`}
                inputMode="numeric"
                placeholder="0"
                value={formatAmountInput(values[c.id] ?? "")}
                onChange={(e) => setValues((v) => ({ ...v, [c.id]: sanitizeAmountDigits(e.target.value) }))}
                className="min-w-0 flex-1 bg-transparent text-right text-[16px] font-semibold text-ink outline-none placeholder:text-muted"
              />
              <span className="text-[13px] text-muted">₫</span>
            </div>
          </li>
        ))}
      </ul>
      <FormError message={error} />
      <Button type="submit" block disabled={pending}>
        {pending ? "Đang lưu…" : "Lưu ngân sách"}
      </Button>
    </form>
  );
}

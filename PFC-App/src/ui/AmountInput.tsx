"use client";

import { useId } from "react";
import { formatAmountInput, sanitizeAmountDigits } from "@/lib/money";
import { cx } from "./cx";

/**
 * VND amount field: numeric keypad on phones (inputMode="numeric"), live "1.200.000"
 * grouping, digits-only value. `value` is the raw digit string ("" when empty).
 */
export function AmountInput({
  value,
  onChange,
  label = "Số tiền (VND)",
  tone = "neutral",
}: {
  value: string;
  onChange: (digits: string) => void;
  label?: string;
  tone?: "neutral" | "income" | "expense";
}) {
  const id = useId();
  return (
    <div>
      <label htmlFor={id} className="mb-1.5 block text-[13px] font-semibold text-ink-2">
        {label}
      </label>
      <div className="flex items-baseline gap-1 rounded-[var(--radius-control)] border border-line bg-surface px-4 py-3 focus-within:border-primary">
        <input
          id={id}
          inputMode="numeric"
          autoComplete="off"
          enterKeyHint="done"
          placeholder="0"
          value={formatAmountInput(value)}
          onChange={(e) => onChange(sanitizeAmountDigits(e.target.value))}
          className={cx(
            "min-w-0 flex-1 bg-transparent text-[28px] font-extrabold tracking-tight outline-none placeholder:text-muted",
            tone === "income" ? "text-income" : tone === "expense" ? "text-expense" : "text-ink",
          )}
        />
        <span className="text-xl font-bold text-muted">₫</span>
      </div>
    </div>
  );
}

import { cx } from "./cx";

/** Linear progress (budgets, goals, learning). Colour follows state, with a text % beside it. */
export function ProgressBar({
  value,
  tone = "primary",
  label,
  className,
}: {
  value: number;
  tone?: "primary" | "income" | "warning" | "expense";
  label: string;
  className?: string;
}) {
  const pct = Math.max(0, Math.min(100, value));
  const tones = { primary: "bg-primary", income: "bg-income", warning: "bg-warning", expense: "bg-expense" } as const;
  return (
    <div
      role="progressbar"
      aria-label={label}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={Math.round(value)}
      className={cx("h-2 w-full overflow-hidden rounded-full bg-surface-2", className)}
    >
      <div className={cx("h-full rounded-full transition-[width] duration-500", tones[tone])} style={{ width: `${pct}%` }} />
    </div>
  );
}

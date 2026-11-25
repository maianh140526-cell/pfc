import type { LucideIcon } from "lucide-react";
import type { ReactNode } from "react";
import { cx } from "./cx";

/** Screen Inventory §5 cross-cutting states: empty / error / offline / coming soon. */
export function EmptyState({
  icon: Icon,
  title,
  description,
  action,
}: {
  icon: LucideIcon;
  title: string;
  description?: string;
  action?: ReactNode;
}) {
  return (
    <div className="flex flex-col items-center px-8 py-12 text-center">
      <span className="mb-4 grid size-20 place-items-center rounded-full bg-primary-soft text-primary">
        <Icon size={36} strokeWidth={1.8} />
      </span>
      <h2 className="text-[18px] font-bold text-ink">{title}</h2>
      {description && <p className="mt-2 max-w-[300px] text-[14px] leading-relaxed text-muted">{description}</p>}
      {action && <div className="mt-6 w-full max-w-[280px]">{action}</div>}
    </div>
  );
}

export function Skeleton({ className }: { className?: string }) {
  return <div className={cx("skeleton rounded-xl", className)} aria-hidden="true" />;
}

export function Badge({
  children,
  tone = "primary",
}: {
  children: ReactNode;
  tone?: "primary" | "income" | "expense" | "warning" | "muted";
}) {
  const tones = {
    primary: "bg-primary-soft text-primary",
    income: "bg-income-soft text-income",
    expense: "bg-expense-soft text-expense",
    warning: "bg-warning-soft text-warning",
    muted: "bg-surface-2 text-muted",
  } as const;
  return (
    <span className={cx("inline-flex shrink-0 items-center rounded-full px-2.5 py-0.5 text-[12px] font-semibold whitespace-nowrap", tones[tone])}>
      {children}
    </span>
  );
}

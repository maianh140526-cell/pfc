import Link from "next/link";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { monthLabel, shiftMonth } from "../domain/dates";

/** "‹ Tháng 9, 2026 ›" (mockup 25/98). Uses ?month= so each month is a linkable URL. */
export function MonthSwitcher({
  month,
  basePath,
  params = {},
  label,
}: {
  month: string;
  basePath: string;
  params?: Record<string, string | undefined>;
  label?: string;
}) {
  const href = (m: string) => {
    const q = new URLSearchParams();
    for (const [k, v] of Object.entries(params)) if (v) q.set(k, v);
    q.set("month", m);
    return `${basePath}?${q.toString()}`;
  };
  const btn = "pressable grid size-10 place-items-center rounded-full bg-surface text-ink-2 border border-line";
  return (
    <div className="flex items-center justify-between gap-2">
      <Link href={href(shiftMonth(month, -1))} className={btn} aria-label="Tháng trước" scroll={false}>
        <ChevronLeft size={20} />
      </Link>
      <span className="rounded-full bg-surface px-4 py-2 text-[14px] font-semibold text-ink shadow-card">
        {label ?? monthLabel(month)}
      </span>
      <Link href={href(shiftMonth(month, 1))} className={btn} aria-label="Tháng sau" scroll={false}>
        <ChevronRight size={20} />
      </Link>
    </div>
  );
}

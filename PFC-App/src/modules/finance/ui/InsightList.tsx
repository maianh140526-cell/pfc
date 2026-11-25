import Link from "next/link";
import { AlertTriangle, ChevronRight, Info, ThumbsUp } from "lucide-react";
import type { Insight } from "../domain/insights";

const TONE = {
  good: { icon: ThumbsUp, cls: "bg-income-soft text-income" },
  warn: { icon: AlertTriangle, cls: "bg-warning-soft text-warning" },
  info: { icon: Info, cls: "bg-primary-soft text-primary" },
} as const;

export function InsightList({ items }: { items: Insight[] }) {
  return (
    <ul className="space-y-2">
      {items.map((x) => {
        const { icon: Icon, cls } = TONE[x.tone];
        const body = (
          <>
            <span className={`grid size-10 shrink-0 place-items-center rounded-2xl ${cls}`}>
              <Icon size={20} />
            </span>
            <span className="min-w-0 flex-1">
              <span className="block text-[14px] font-bold text-ink">{x.title}</span>
              <span className="block text-[13px] text-ink-2">{x.body}</span>
            </span>
            {x.href && <ChevronRight size={18} className="shrink-0 text-muted" />}
          </>
        );
        return (
          <li key={x.id}>
            {x.href ? (
              <Link href={x.href} className="pressable flex items-center gap-3 rounded-[var(--radius-card)] border border-line bg-surface p-3">
                {body}
              </Link>
            ) : (
              <div className="flex items-center gap-3 rounded-[var(--radius-card)] border border-line bg-surface p-3">{body}</div>
            )}
          </li>
        );
      })}
    </ul>
  );
}

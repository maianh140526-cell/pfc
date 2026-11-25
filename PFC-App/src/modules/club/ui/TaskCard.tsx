import Link from "next/link";
import { CalendarClock, CheckSquare, MessageSquare } from "lucide-react";
import { Badge } from "@/ui";
import { ProgressBar } from "@/ui/ProgressBar";
import { PRIORITY, fmtDate, toDate, type BoardTask } from "../types";

export function TaskCard({ t }: { t: BoardTask }) {
  const due = toDate(t.deadline);
  const overdue = due && due.getTime() < Date.now() && t.status !== "done";
  const pct = t.progressPct ?? t.progress ?? (t.checklistTotal ? ((t.checklistDone ?? 0) / t.checklistTotal) * 100 : 0);
  return (
    <Link href={`/club/tasks/${t.id}`} className="pressable block rounded-[var(--radius-card)] border border-line bg-surface p-3.5 shadow-card">
      <div className="flex items-start justify-between gap-2">
        <span className="line-clamp-2 text-[15px] font-semibold text-ink">{t.title}</span>
        <Badge tone={PRIORITY[t.priority]?.tone ?? "muted"}>{PRIORITY[t.priority]?.label ?? t.priority}</Badge>
      </div>
      {t.teamName && <p className="mt-0.5 text-[12px] text-muted">{t.teamName}</p>}
      {pct > 0 && <ProgressBar className="mt-2.5" value={pct} label={`Tiến độ ${Math.round(pct)}%`} />}
      <div className="mt-2.5 flex items-center gap-3 text-[12px] text-muted">
        {t.assigneeName && (
          <span className="flex items-center gap-1.5">
            <span className="grid size-6 place-items-center rounded-full bg-primary-soft text-[10px] font-bold text-primary">{t.assigneeInitials}</span>
            <span className="max-w-24 truncate">{t.assigneeName}</span>
          </span>
        )}
        {due && (
          <span className={`flex items-center gap-1 ${overdue ? "font-semibold text-expense" : ""}`}>
            <CalendarClock size={14} /> {fmtDate(t.deadline)}
          </span>
        )}
        {!!t.checklistTotal && (
          <span className="flex items-center gap-1">
            <CheckSquare size={14} /> {t.checklistDone ?? 0}/{t.checklistTotal}
          </span>
        )}
        {!!t.commentCount && (
          <span className="flex items-center gap-1">
            <MessageSquare size={14} /> {t.commentCount}
          </span>
        )}
      </div>
    </Link>
  );
}

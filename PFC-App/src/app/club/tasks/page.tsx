"use client";

import { useSearchParams } from "next/navigation";
import { KanbanSquare, Plus } from "lucide-react";
import { useMemo, useState } from "react";
import { allTasks, useClub } from "@/modules/club/session";
import { KANBAN_COLUMNS, TASK_STATUS_LABEL, fmtDate, toDate, type TaskStatus } from "@/modules/club/types";
import { TaskCard } from "@/modules/club/ui/TaskCard";
import { AppHeader, EmptyState, HeaderIconButton, SegmentedTabs } from "@/ui";
import { cx } from "@/ui/cx";

/** FR-CLB-004/005 Tasks: Kanban by column (one column at a time on a phone) + Timeline. */
export default function ClubTasksPage() {
  const { home, can } = useClub();
  const params = useSearchParams();
  const [view, setView] = useState<"kanban" | "timeline">("kanban");
  const [mine, setMine] = useState(params.get("mine") === "1");
  const [col, setCol] = useState<TaskStatus>("todo");
  const canCreate = home.taskScope?.canManageTasks ?? can("manage_tasks");

  const tasks = useMemo(() => allTasks(home).filter((t) => !mine || t.assigneeId === home.user.id), [home, mine]);
  const byCol = (s: TaskStatus) => tasks.filter((t) => t.status === s);
  const timeline = tasks
    .filter((t) => t.deadline && t.status !== "done" && t.status !== "cancelled")
    .sort((a, b) => (toDate(a.deadline)!.getTime() - toDate(b.deadline)!.getTime()));

  return (
    <>
      <AppHeader
        title="Công việc"
        backHref="/club"
        actions={
          canCreate && (
            <HeaderIconButton label="Tạo công việc" href="/club/tasks/new">
              <Plus size={24} />
            </HeaderIconButton>
          )
        }
      />
      <div className="space-y-3 px-4">
        <div className="flex items-center justify-between gap-2">
          <SegmentedTabs
            label="Chế độ xem"
            value={view}
            onChange={setView}
            options={[
              { value: "kanban", label: "Kanban" },
              { value: "timeline", label: "Timeline" },
            ]}
          />
          <label className="flex items-center gap-2 text-[14px] font-semibold text-ink-2">
            <input type="checkbox" checked={mine} onChange={(e) => setMine(e.target.checked)} className="size-5 accent-[var(--pfc-primary)]" />
            Của tôi
          </label>
        </div>
        {view === "kanban" && (
          <div className="no-scrollbar -mx-4 flex gap-2 overflow-x-auto px-4" role="tablist" aria-label="Cột Kanban">
            {KANBAN_COLUMNS.map((s) => (
              <button
                key={s}
                type="button"
                role="tab"
                aria-selected={col === s}
                onClick={() => setCol(s)}
                className={cx(
                  "pressable flex shrink-0 items-center gap-1.5 rounded-full px-4 py-2 text-[14px] font-semibold",
                  col === s ? "bg-primary text-on-primary" : "border border-line bg-surface text-ink-2",
                )}
              >
                {TASK_STATUS_LABEL[s]}
                <span className={cx("rounded-full px-1.5 text-[12px]", col === s ? "bg-white/25" : "bg-surface-2")}>{byCol(s).length}</span>
              </button>
            ))}
          </div>
        )}
      </div>

      {view === "kanban" ? (
        byCol(col).length === 0 ? (
          <EmptyState icon={KanbanSquare} title={`Không có việc “${TASK_STATUS_LABEL[col]}”`} description={mine ? "Bạn không có việc ở cột này." : "Cột này đang trống."} />
        ) : (
          <div className="space-y-3 px-4 pt-3">
            {byCol(col).map((t) => (
              <TaskCard key={t.id} t={t} />
            ))}
          </div>
        )
      ) : timeline.length === 0 ? (
        <EmptyState icon={KanbanSquare} title="Chưa có hạn chót nào" description="Công việc có deadline sẽ hiện theo thứ tự thời gian." />
      ) : (
        <ol className="space-y-3 px-4 pt-3">
          {timeline.map((t) => (
            <li key={t.id} className="flex gap-3">
              <div className="w-14 shrink-0 pt-3 text-right text-[12px] font-semibold text-muted">{fmtDate(t.deadline).slice(0, 5)}</div>
              <div className="min-w-0 flex-1">
                <TaskCard t={t} />
              </div>
            </li>
          ))}
        </ol>
      )}
    </>
  );
}

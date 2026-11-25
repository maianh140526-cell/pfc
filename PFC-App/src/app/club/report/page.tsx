"use client";

import { ChartColumn } from "lucide-react";
import { useClub } from "@/modules/club/session";
import { KANBAN_COLUMNS, TASK_STATUS_LABEL } from "@/modules/club/types";
import { AppHeader, Card, EmptyState, Section } from "@/ui";
import { BarChart } from "@/ui/charts";

/** FR-CLB-009 Club Report (mockup 126) — figures come from the Club service, not computed here. */
export default function ClubReportPage() {
  const { home, can } = useClub();
  const r = home.report;
  if (!can("view_reports") || !r) {
    return (
      <>
        <AppHeader back backFallback="/club/more" title="Báo cáo CLB" />
        <EmptyState icon={ChartColumn} title="Không có quyền xem báo cáo" />
      </>
    );
  }
  const tiles = [
    ["Thành viên hoạt động", r.members.active],
    ["Chờ duyệt", r.members.pending],
    ["Mới tháng này", r.members.joinedThisMonth ?? 0],
    ["Công việc xong tháng này", r.tasks.doneThisMonth ?? 0],
    ["Hoạt động", r.activities],
    ["Sự kiện liên kết", r.linkedEvents],
  ] as const;

  return (
    <>
      <AppHeader back backFallback="/club/more" title="Báo cáo CLB" />
      <Section>
        <div className="grid grid-cols-2 gap-3">
          {tiles.map(([k, v]) => (
            <Card key={k} className="p-3.5">
              <p className="text-[24px] font-extrabold text-ink">{v}</p>
              <p className="text-[12px] text-muted">{k}</p>
            </Card>
          ))}
        </div>
      </Section>
      <Section title={`Công việc theo trạng thái (${r.tasks.total})`}>
        <Card>
          <BarChart
            tone="primary"
            label="Số công việc theo trạng thái"
            data={KANBAN_COLUMNS.map((s) => ({ key: s, label: TASK_STATUS_LABEL[s], value: r.tasks.byStatus[s] ?? 0 }))}
          />
        </Card>
        <p className="mt-2 text-[12px] text-muted">Số liệu tính bởi máy chủ Câu lạc bộ (đơn vị: công việc).</p>
      </Section>
    </>
  );
}

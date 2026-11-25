import { notFound } from "next/navigation";
import { requireMember } from "@/platform/auth/session";
import { formatVnd } from "@/lib/money";
import { changePct } from "@/modules/finance/domain/analytics";
import { shortMonthLabel } from "@/modules/finance/domain/dates";
import { categorySlices, listCategories, monthOverview, seriesEnding } from "@/modules/finance/server/queries";
import { CategoryBadge } from "@/modules/finance/ui/CategoryIcon";
import { MonthSwitcher } from "@/modules/finance/ui/MonthSwitcher";
import { monthParam } from "@/modules/finance/ui/page-params";
import { AppHeader, Card, EmptyState, Section } from "@/ui";
import { BarChart } from "@/ui/charts";
import { ProgressBar } from "@/ui/ProgressBar";
import { ChartColumn } from "lucide-react";

/** FIN-02 Income Overview / FIN-03 Expense Overview (mockups 19 / 20). */
export default async function OverviewPage({
  params,
  searchParams,
}: {
  params: Promise<{ type: string }>;
  searchParams: Promise<Record<string, string>>;
}) {
  const { type } = await params;
  if (type !== "income" && type !== "expense") notFound();
  const me = await requireMember(`/finance/overview/${type}`);
  const month = monthParam((await searchParams).month);
  const [overview, categories, series] = await Promise.all([
    monthOverview(me.id, month),
    listCategories(me.id, { includeArchived: true }),
    seriesEnding(me.id, month, 9),
  ]);
  const total = overview.totals[type];
  const pct = changePct(total, overview.previous[type]);
  const slices = categorySlices(overview.transactions, type, categories, 8);
  const isIncome = type === "income";
  const title = isIncome ? "Thu nhập" : "Chi tiêu";

  return (
    <>
      <AppHeader back backFallback="/finance" title={title} />
      <div className="px-4">
        <MonthSwitcher month={month} basePath={`/finance/overview/${type}`} />
      </div>
      <Section>
        <Card>
          <p className="text-[13px] text-muted">Tổng {title.toLowerCase()}</p>
          <p className={`text-[28px] font-extrabold ${isIncome ? "text-income" : "text-expense"}`}>{formatVnd(total)}</p>
          {pct === null ? (
            <p className="text-[12px] text-muted">Chưa có dữ liệu tháng trước để so sánh</p>
          ) : (
            <p className={`text-[13px] font-semibold ${(pct >= 0) === isIncome ? "text-income" : "text-expense"}`}>
              {pct >= 0 ? "↑" : "↓"} {Math.abs(pct).toFixed(0)}% so với tháng trước
            </p>
          )}
          <div className="mt-4">
            <BarChart
              tone={type}
              label={`${title} 9 tháng gần nhất`}
              data={series.map((s) => ({ key: s.month, label: shortMonthLabel(s.month), value: s[type] }))}
            />
          </div>
        </Card>
      </Section>
      <Section title={isIncome ? "Nguồn thu nhập" : "Danh mục chi nhiều nhất"}>
        {slices.length === 0 ? (
          <EmptyState icon={ChartColumn} title="Chưa có dữ liệu" description={`Chưa có khoản ${title.toLowerCase()} nào trong tháng này.`} />
        ) : (
          <ul className="divide-y divide-line rounded-[var(--radius-card)] border border-line bg-surface">
            {slices.map((s) => (
              <li key={s.categoryId ?? "other"} className="flex items-center gap-3 px-4 py-3">
                <CategoryBadge icon={s.icon} type={type} size="sm" />
                <div className="min-w-0 flex-1">
                  <div className="flex items-baseline justify-between gap-2">
                    <span className="truncate text-[15px] font-semibold text-ink">{s.name}</span>
                    <span className="text-[14px] font-bold text-ink">{formatVnd(s.amount)}</span>
                  </div>
                  <div className="mt-1.5 flex items-center gap-2">
                    <ProgressBar value={s.share * 100} tone={isIncome ? "income" : "expense"} label={`${s.name} ${Math.round(s.share * 100)}%`} />
                    <span className="w-9 text-right text-[12px] text-muted">{Math.round(s.share * 100)}%</span>
                  </div>
                </div>
              </li>
            ))}
          </ul>
        )}
      </Section>
    </>
  );
}

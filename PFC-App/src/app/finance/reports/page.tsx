import Link from "next/link";
import { ChartColumn, Download } from "lucide-react";
import { requireMember } from "@/platform/auth/session";
import { formatVnd } from "@/lib/money";
import { monthlySeries, totals } from "@/modules/finance/domain/analytics";
import { periodLabel, periodRange, shiftMonth, shortMonthLabel, type PeriodKind } from "@/modules/finance/domain/dates";
import { categorySlices, listCategories, listTransactions } from "@/modules/finance/server/queries";
import { FilterChips } from "@/ui/FilterChips";
import { firstParam, monthParam } from "@/modules/finance/ui/page-params";
import { AppHeader, Card, EmptyState, Section } from "@/ui";
import { DonutChart, PairedBarChart } from "@/ui/charts";
import { ChevronLeft, ChevronRight } from "lucide-react";

export const metadata = { title: "Báo cáo" };

const STEP: Record<PeriodKind, number> = { month: 1, quarter: 3, year: 12 };

/** FIN-18 Financial Analytics / FIN-19 Reports (mockup 31 / 101) + FIN-20 export. */
export default async function ReportsPage({ searchParams }: { searchParams: Promise<Record<string, string>> }) {
  const me = await requireMember("/finance/reports");
  const sp = await searchParams;
  const kindRaw = firstParam(sp.period);
  const kind: PeriodKind = kindRaw === "quarter" || kindRaw === "year" ? kindRaw : "month";
  const month = monthParam(sp.month);
  const range = periodRange(kind, month);
  const [txs, categories] = await Promise.all([
    listTransactions(me.id, { start: range.start, end: range.end, limit: 5000 }),
    listCategories(me.id, { includeArchived: true }),
  ]);
  const sum = totals(txs);
  const slices = categorySlices(txs, "expense", categories);
  const series = monthlySeries(txs, range.months);
  const savingRate = sum.income > 0 ? Math.round((sum.net / sum.income) * 100) : null;
  const href = (k: string, m = month) => `/finance/reports?period=${k}&month=${m}`;
  const nav = "pressable grid size-10 place-items-center rounded-full border border-line bg-surface text-ink-2";

  return (
    <>
      <AppHeader back backFallback="/finance/more" title="Báo cáo tài chính" />
      <div className="space-y-3 px-4">
        <FilterChips
          label="Kỳ báo cáo"
          value={kind}
          hrefFor={(k) => href(k)}
          options={[
            { value: "month", label: "Tháng" },
            { value: "quarter", label: "Quý" },
            { value: "year", label: "Năm" },
          ]}
        />
        <div className="flex items-center justify-between">
          <Link href={href(kind, shiftMonth(month, -STEP[kind]))} className={nav} aria-label="Kỳ trước" scroll={false}>
            <ChevronLeft size={20} />
          </Link>
          <span className="rounded-full bg-surface px-4 py-2 text-[14px] font-semibold text-ink shadow-card">{periodLabel(kind, month)}</span>
          <Link href={href(kind, shiftMonth(month, STEP[kind]))} className={nav} aria-label="Kỳ sau" scroll={false}>
            <ChevronRight size={20} />
          </Link>
        </div>
      </div>

      <Section>
        <div className="grid grid-cols-2 gap-3">
          <Card className="p-3.5">
            <p className="text-[12px] text-muted">Tổng thu</p>
            <p className="text-[16px] font-extrabold text-income">{formatVnd(sum.income)}</p>
          </Card>
          <Card className="p-3.5">
            <p className="text-[12px] text-muted">Tổng chi</p>
            <p className="text-[16px] font-extrabold text-expense">{formatVnd(sum.expense)}</p>
          </Card>
          <Card className="col-span-2 p-3.5">
            <p className="text-[12px] text-muted">Tiết kiệm ròng</p>
            <p className={`text-[20px] font-extrabold ${sum.net < 0 ? "text-expense" : "text-ink"}`}>
              {sum.net < 0 ? "−" : ""}
              {formatVnd(Math.abs(sum.net))}
              {savingRate !== null && <span className="ml-2 text-[13px] font-semibold text-muted">({savingRate}% thu nhập)</span>}
            </p>
          </Card>
        </div>
      </Section>

      {txs.length === 0 ? (
        <EmptyState icon={ChartColumn} title="Chưa có dữ liệu trong kỳ" description="Thêm giao dịch để xem báo cáo thu chi." />
      ) : (
        <>
          {range.months.length > 1 && (
            <Section title="Thu chi theo tháng">
              <Card>
                <PairedBarChart
                  label={`Thu chi theo tháng, ${periodLabel(kind, month)}`}
                  data={series.map((s) => ({ key: s.month, label: shortMonthLabel(s.month), ...s }))}
                />
              </Card>
            </Section>
          )}
          {slices.length > 0 && (
            <Section title="Chi tiêu theo danh mục">
              <Card>
                <DonutChart
                  slices={slices.map((s) => ({ key: s.categoryId ?? "other", label: s.name, amount: s.amount, share: s.share, isOther: s.categoryId === null }))}
                  centerLabel="Tổng chi"
                  centerValue={formatVnd(sum.expense)}
                />
              </Card>
            </Section>
          )}
        </>
      )}

      <Section>
        <a
          href={`/finance/export?period=${kind}&month=${month}`}
          className="pressable flex min-h-12 w-full items-center justify-center gap-2 rounded-[var(--radius-control)] bg-primary px-5 text-[15px] font-semibold text-on-primary shadow-card"
          download
        >
          <Download size={18} /> Xuất báo cáo CSV
        </a>
        <p className="mt-2 text-center text-[12px] text-muted">Tệp CSV mở được bằng Excel / Google Sheets.</p>
      </Section>
    </>
  );
}

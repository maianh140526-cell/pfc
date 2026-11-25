import Link from "next/link";
import { ArrowDownLeft, ArrowUpRight, ChartColumn, PieChart, PiggyBank, Target } from "lucide-react";
import { requireMember } from "@/platform/auth/session";
import { formatVnd } from "@/lib/money";
import { changePct } from "@/modules/finance/domain/analytics";
import { daysBetween, shortMonthLabel, todayLocal } from "@/modules/finance/domain/dates";
import {
  budgetsForMonth,
  categorySlices,
  listCategories,
  listGoals,
  monthOverview,
  seriesEnding,
} from "@/modules/finance/server/queries";
import { insightsFor } from "@/modules/finance/server/insights";
import { InsightList } from "@/modules/finance/ui/InsightList";
import { MonthSwitcher } from "@/modules/finance/ui/MonthSwitcher";
import { TxRow } from "@/modules/finance/ui/TxList";
import { monthParam } from "@/modules/finance/ui/page-params";
import { AppHeader, Card, EmptyState, Section } from "@/ui";
import { ButtonLink } from "@/ui/Button";
import { DonutChart, PairedBarChart } from "@/ui/charts";
import { ProgressBar } from "@/ui/ProgressBar";

export const metadata = { title: "Tổng quan" };

function Delta({ pct, goodWhenUp }: { pct: number | null; goodWhenUp: boolean }) {
  if (pct === null) return <span className="text-[12px] text-muted">Chưa có tháng trước</span>;
  const up = pct >= 0;
  const good = up === goodWhenUp;
  return (
    <span className={`text-[12px] font-semibold ${good ? "text-income" : "text-expense"}`}>
      {up ? "↑" : "↓"} {Math.abs(pct).toFixed(0)}% so với tháng trước
    </span>
  );
}

/** FIN-01 Financial Dashboard (mockups 18 / 97 / 109). */
export default async function FinanceDashboard({ searchParams }: { searchParams: Promise<Record<string, string>> }) {
  const me = await requireMember("/finance");
  const month = monthParam((await searchParams).month);
  const [overview, categories, budgets, goals, series, insightItems] = await Promise.all([
    monthOverview(me.id, month),
    listCategories(me.id, { includeArchived: true }),
    budgetsForMonth(me.id, month),
    listGoals(me.id),
    seriesEnding(me.id, month, 6),
    insightsFor(me.id, month),
  ]);
  const { totals, previous, transactions } = overview;
  const slices = categorySlices(transactions, "expense", categories);
  const budgetLimit = budgets.reduce((a, b) => a + b.limit, 0);
  const budgetSpent = budgets.reduce((a, b) => a + b.spent, 0);
  const activeGoals = goals.filter((g) => g.current < g.target).slice(0, 2);
  const firstName = me.fullName.trim().split(/\s+/).at(-1);

  return (
    <>
      <AppHeader backHref="/home" title="Tài chính cá nhân" />
      <div className="px-4">
        <p className="text-[15px] text-muted">Xin chào, {firstName} 👋</p>
        <div className="mt-3">
          <MonthSwitcher month={month} basePath="/finance" />
        </div>
      </div>

      <Section>
        <div className="rounded-[var(--radius-card)] bg-primary p-5 text-on-primary shadow-sheet">
          <p className="text-[13px] opacity-90">Số dư trong tháng</p>
          <p className="mt-1 text-[30px] leading-tight font-extrabold tracking-tight">
            {totals.net < 0 ? "−" : ""}
            {formatVnd(Math.abs(totals.net))}
          </p>
          <p className="mt-1 text-[12px] opacity-90">
            {totals.income > 0 ? `Tiết kiệm ${Math.round((totals.net / totals.income) * 100)}% thu nhập` : "Chưa có thu nhập trong tháng"}
          </p>
        </div>
        <div className="mt-3 grid grid-cols-2 gap-3">
          <Link href={`/finance/overview/income?month=${month}`} className="pressable">
            <Card className="h-full p-4">
              <span className="flex items-center gap-1.5 text-[13px] text-muted">
                <ArrowDownLeft size={16} className="text-income" /> Thu nhập
              </span>
              <p className="mt-1 text-[17px] font-extrabold text-ink">{formatVnd(totals.income)}</p>
              <Delta pct={changePct(totals.income, previous.income)} goodWhenUp />
            </Card>
          </Link>
          <Link href={`/finance/overview/expense?month=${month}`} className="pressable">
            <Card className="h-full p-4">
              <span className="flex items-center gap-1.5 text-[13px] text-muted">
                <ArrowUpRight size={16} className="text-expense" /> Chi tiêu
              </span>
              <p className="mt-1 text-[17px] font-extrabold text-ink">{formatVnd(totals.expense)}</p>
              <Delta pct={changePct(totals.expense, previous.expense)} goodWhenUp={false} />
            </Card>
          </Link>
        </div>
      </Section>

      <Section>
        <ul className="grid grid-cols-4 gap-2 text-center">
          {[
            { href: "/finance/budgets", label: "Ngân sách", icon: PieChart },
            { href: "/finance/goals", label: "Mục tiêu", icon: Target },
            { href: "/finance/challenges", label: "Thử thách", icon: PiggyBank },
            { href: "/finance/reports", label: "Báo cáo", icon: ChartColumn },
          ].map(({ href, label, icon: Icon }) => (
            <li key={href}>
              <Link href={href} className="pressable flex flex-col items-center gap-1.5 text-[12px] font-semibold text-ink-2">
                <span className="grid size-12 place-items-center rounded-2xl bg-primary-soft text-primary">
                  <Icon size={22} />
                </span>
                {label}
              </Link>
            </li>
          ))}
        </ul>
      </Section>

      {insightItems.length > 0 && insightItems[0].id !== "empty" && (
        <Section title="Gợi ý cho bạn" action={<Link href={`/finance/insights?month=${month}`} className="text-[13px] font-semibold text-primary">Xem thêm</Link>}>
          <InsightList items={insightItems.slice(0, 2)} />
        </Section>
      )}

      {transactions.length === 0 ? (
        <EmptyState
          icon={ArrowUpRight}
          title="Chưa có giao dịch trong tháng"
          description="Ghi lại khoản thu chi đầu tiên để xem phân tích chi tiêu và ngân sách."
          action={
            <ButtonLink href="/finance/transactions/new" block>
              Thêm giao dịch
            </ButtonLink>
          }
        />
      ) : (
        <>
          {slices.length > 0 && (
            <Section title="Cơ cấu chi tiêu">
              <Card>
                <DonutChart
                  slices={slices.map((s) => ({
                    key: s.categoryId ?? "other",
                    label: s.name,
                    amount: s.amount,
                    share: s.share,
                    isOther: s.categoryId === null,
                  }))}
                  centerLabel="Tổng chi"
                  centerValue={formatVnd(totals.expense)}
                />
              </Card>
            </Section>
          )}

          <Section title="Thu chi 6 tháng">
            <Card>
              <PairedBarChart
                label="Thu nhập và chi tiêu 6 tháng gần nhất"
                data={series.map((s) => ({ key: s.month, label: shortMonthLabel(s.month), income: s.income, expense: s.expense }))}
              />
            </Card>
          </Section>

          <Section
            title="Giao dịch gần đây"
            action={
              <Link href={`/finance/transactions?month=${month}`} className="text-[14px] font-semibold text-primary">
                Xem tất cả
              </Link>
            }
          >
            <ul className="divide-y divide-line overflow-hidden rounded-[var(--radius-card)] border border-line bg-surface">
              {transactions.slice(0, 5).map((t) => (
                <TxRow key={t.id} t={t} />
              ))}
            </ul>
          </Section>
        </>
      )}

      <Section
        title="Ngân sách tháng"
        action={
          <Link href={`/finance/budgets?month=${month}`} className="text-[14px] font-semibold text-primary">
            Chi tiết
          </Link>
        }
      >
        {budgets.length === 0 ? (
          <Link href={`/finance/budgets/new?month=${month}`} className="pressable block">
            <Card className="text-center text-[14px] text-muted">
              Chưa đặt ngân sách cho tháng này. <span className="font-semibold text-primary">Lập ngân sách</span>
            </Card>
          </Link>
        ) : (
          <Card>
            <div className="flex items-baseline justify-between">
              <span className="text-[14px] text-muted">Đã chi</span>
              <span className="text-[15px] font-bold text-ink">
                {formatVnd(budgetSpent)} <span className="font-normal text-muted">/ {formatVnd(budgetLimit)}</span>
              </span>
            </div>
            <ProgressBar
              className="mt-2"
              label="Tổng ngân sách đã dùng"
              value={(budgetSpent / budgetLimit) * 100}
              tone={budgetSpent > budgetLimit ? "expense" : budgetSpent / budgetLimit >= 0.8 ? "warning" : "primary"}
            />
          </Card>
        )}
      </Section>

      {activeGoals.length > 0 && (
        <Section
          title="Mục tiêu tiết kiệm"
          action={
            <Link href="/finance/goals" className="text-[14px] font-semibold text-primary">
              Xem tất cả
            </Link>
          }
        >
          <div className="space-y-3">
            {activeGoals.map((g) => (
              <Link key={g.id} href={`/finance/goals/${g.id}`} className="pressable block">
                <Card>
                  <div className="flex items-baseline justify-between gap-2">
                    <span className="truncate text-[15px] font-semibold text-ink">{g.name}</span>
                    <span className="text-[13px] font-semibold text-primary">{Math.floor((g.current / g.target) * 100)}%</span>
                  </div>
                  <ProgressBar className="mt-2" label={`Tiến độ ${g.name}`} value={(g.current / g.target) * 100} />
                  <p className="mt-2 text-[12px] text-muted">
                    {formatVnd(g.current)} / {formatVnd(g.target)} · còn {Math.max(0, daysBetween(todayLocal(), g.deadline))} ngày
                  </p>
                </Card>
              </Link>
            ))}
          </div>
        </Section>
      )}
    </>
  );
}

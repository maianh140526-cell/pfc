import Link from "next/link";
import { PieChart, Plus } from "lucide-react";
import { requireMember } from "@/platform/auth/session";
import { formatVnd } from "@/lib/money";
import { budgetsForMonth } from "@/modules/finance/server/queries";
import { CategoryBadge } from "@/modules/finance/ui/CategoryIcon";
import { MonthSwitcher } from "@/modules/finance/ui/MonthSwitcher";
import { monthParam } from "@/modules/finance/ui/page-params";
import { AppHeader, ButtonLink, Card, EmptyState, Section } from "@/ui";
import { ProgressBar } from "@/ui/ProgressBar";
import { CopyBudgetsButton } from "./CopyBudgetsButton";

export const metadata = { title: "Ngân sách" };

const toneOf = (state: "ok" | "warning" | "over") => (state === "over" ? "expense" : state === "warning" ? "warning" : "primary");

/** FIN-09 Budget Overview (mockup 25 / 99). */
export default async function BudgetsPage({ searchParams }: { searchParams: Promise<Record<string, string>> }) {
  const me = await requireMember("/finance/budgets");
  const month = monthParam((await searchParams).month);
  const budgets = await budgetsForMonth(me.id, month);
  const limit = budgets.reduce((a, b) => a + b.limit, 0);
  const spent = budgets.reduce((a, b) => a + b.spent, 0);
  const pct = limit > 0 ? (spent / limit) * 100 : 0;

  return (
    <>
      <AppHeader title="Ngân sách" backHref="/finance" />
      <div className="px-4">
        <MonthSwitcher month={month} basePath="/finance/budgets" />
      </div>
      {budgets.length === 0 ? (
        <>
          <EmptyState
            icon={PieChart}
            title="Chưa có ngân sách tháng này"
            description="Đặt hạn mức cho từng danh mục chi tiêu để PFC cảnh báo khi bạn sắp vượt."
            action={
              <ButtonLink href={`/finance/budgets/new?month=${month}`} block>
                Lập ngân sách
              </ButtonLink>
            }
          />
          <div className="px-4">
            <CopyBudgetsButton month={month} />
          </div>
        </>
      ) : (
        <>
          <Section>
            <Card className="flex items-center gap-4">
              <div
                className="grid size-24 shrink-0 place-items-center rounded-full"
                style={{
                  background: `conic-gradient(var(--pfc-${pct > 100 ? "expense" : pct >= 80 ? "warning" : "primary"}) ${Math.min(pct, 100) * 3.6}deg, var(--pfc-surface-2) 0)`,
                }}
                role="img"
                aria-label={`Đã dùng ${Math.round(pct)}% ngân sách`}
              >
                <span className="grid size-[76px] place-items-center rounded-full bg-surface text-[18px] font-extrabold text-ink">
                  {Math.round(pct)}%
                </span>
              </div>
              <div className="min-w-0">
                <p className="text-[13px] text-muted">Đã chi</p>
                <p className="text-[20px] font-extrabold text-ink">{formatVnd(spent)}</p>
                <p className="text-[13px] text-muted">trên {formatVnd(limit)}</p>
                <p className={`mt-1 text-[13px] font-semibold ${limit - spent < 0 ? "text-expense" : "text-income"}`}>
                  {limit - spent < 0 ? `Vượt ${formatVnd(spent - limit)}` : `Còn lại ${formatVnd(limit - spent)}`}
                </p>
              </div>
            </Card>
          </Section>
          <Section
            title="Theo danh mục"
            action={
              <Link href={`/finance/budgets/new?month=${month}`} className="flex items-center gap-1 text-[14px] font-semibold text-primary">
                <Plus size={16} /> Thêm
              </Link>
            }
          >
            <ul className="space-y-3">
              {budgets.map((b) => (
                <li key={b.id}>
                  <Link href={`/finance/budgets/${b.id}`} className="pressable block">
                    <Card className="p-3.5">
                      <div className="flex items-center gap-3">
                        <CategoryBadge icon={b.categoryIcon} type="expense" size="sm" />
                        <div className="min-w-0 flex-1">
                          <div className="flex items-baseline justify-between gap-2">
                            <span className="truncate text-[15px] font-semibold text-ink">{b.categoryName}</span>
                            <span className={`text-[13px] font-bold ${b.state === "over" ? "text-expense" : "text-ink-2"}`}>{Math.round(b.pct)}%</span>
                          </div>
                          <p className="text-[12px] text-muted">
                            {formatVnd(b.spent)} / {formatVnd(b.limit)}
                          </p>
                        </div>
                      </div>
                      <ProgressBar className="mt-2.5" value={b.pct} tone={toneOf(b.state)} label={`${b.categoryName}: đã dùng ${Math.round(b.pct)}%`} />
                    </Card>
                  </Link>
                </li>
              ))}
            </ul>
          </Section>
        </>
      )}
    </>
  );
}

import { notFound } from "next/navigation";
import { requireMember } from "@/platform/auth/session";
import { formatVnd } from "@/lib/money";
import { monthLabel, monthRange } from "@/modules/finance/domain/dates";
import { getBudget, listTransactions } from "@/modules/finance/server/queries";
import { CategoryBadge } from "@/modules/finance/ui/CategoryIcon";
import { TxRow } from "@/modules/finance/ui/TxList";
import { AppHeader, ButtonLink, Card, Section } from "@/ui";
import { ProgressBar } from "@/ui/ProgressBar";
import { DeleteBudgetButton } from "./DeleteBudgetButton";

export const metadata = { title: "Chi tiết ngân sách" };

/** FIN-12 Budget Detail (mockup 27). */
export default async function BudgetDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const me = await requireMember(`/finance/budgets/${id}`);
  const b = await getBudget(me.id, id);
  if (!b) notFound();
  const txs = await listTransactions(me.id, { ...monthRange(b.month), categoryId: b.categoryId, type: "expense" });

  return (
    <>
      <AppHeader back backFallback={`/finance/budgets?month=${b.month}`} title={b.categoryName} />
      <Section>
        <Card>
          <div className="flex items-center gap-3">
            <CategoryBadge icon={b.categoryIcon} type="expense" />
            <div>
              <p className="text-[13px] text-muted">{monthLabel(b.month)}</p>
              <p className="text-[18px] font-extrabold text-ink">
                {formatVnd(b.spent)} <span className="text-[14px] font-medium text-muted">/ {formatVnd(b.limit)}</span>
              </p>
            </div>
          </div>
          <ProgressBar
            className="mt-3"
            value={b.pct}
            tone={b.state === "over" ? "expense" : b.state === "warning" ? "warning" : "primary"}
            label={`Đã dùng ${Math.round(b.pct)}%`}
          />
          <p className={`mt-2 text-[14px] font-semibold ${b.remaining < 0 ? "text-expense" : "text-income"}`}>
            {b.remaining < 0 ? `Đã vượt ${formatVnd(-b.remaining)}` : `Còn lại ${formatVnd(b.remaining)}`} · {Math.round(b.pct)}%
          </p>
        </Card>
      </Section>
      <Section title={`Giao dịch ${b.categoryName.toLowerCase()}`}>
        {txs.length === 0 ? (
          <p className="rounded-[var(--radius-card)] border border-line bg-surface p-4 text-center text-[14px] text-muted">
            Chưa có khoản chi nào trong danh mục này.
          </p>
        ) : (
          <ul className="divide-y divide-line overflow-hidden rounded-[var(--radius-card)] border border-line bg-surface">
            {txs.map((t) => (
              <TxRow key={t.id} t={t} />
            ))}
          </ul>
        )}
      </Section>
      <Section>
        <div className="grid grid-cols-2 gap-3">
          <ButtonLink href={`/finance/budgets/new?month=${b.month}`} variant="secondary">
            Sửa hạn mức
          </ButtonLink>
          <DeleteBudgetButton id={b.id} month={b.month} />
        </div>
      </Section>
    </>
  );
}

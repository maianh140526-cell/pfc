import { notFound } from "next/navigation";
import { requireMember } from "@/platform/auth/session";
import { formatDateTimeVN } from "@/modules/finance/domain/dates";
import { getTransaction } from "@/modules/finance/server/queries";
import { CategoryBadge } from "@/modules/finance/ui/CategoryIcon";
import { signedAmount } from "@/modules/finance/ui/TxList";
import { AppHeader, Badge, Section } from "@/ui";
import { TransactionActions } from "./TransactionActions";

export const metadata = { title: "Chi tiết giao dịch" };

/** FIN-07 Transaction Detail (mockup 23 / 30). */
export default async function TransactionDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const me = await requireMember(`/finance/transactions/${id}`);
  const t = await getTransaction(me.id, id);
  if (!t) notFound();

  const rows: Array<[string, string]> = [
    ["Loại", t.type === "income" ? "Thu nhập" : "Chi tiêu"],
    ["Ngày giờ", formatDateTimeVN(t.occurredAt)],
    ["Danh mục", t.categoryName],
    ["Ghi chú", t.note || "—"],
  ];

  return (
    <>
      <AppHeader back backFallback="/finance/transactions" title="Chi tiết giao dịch" />
      <div className="flex flex-col items-center px-4 pt-4 text-center">
        <CategoryBadge icon={t.categoryIcon} type={t.type} size="lg" />
        <p className="mt-3 text-[17px] font-semibold text-ink">{t.note || t.categoryName}</p>
        <p className={`mt-1 text-[30px] font-extrabold ${t.type === "income" ? "text-income" : "text-expense"}`}>{signedAmount(t)}</p>
        <div className="mt-2">
          <Badge tone={t.type === "income" ? "income" : "expense"}>{t.categoryName}</Badge>
        </div>
      </div>
      <Section>
        <dl className="divide-y divide-line rounded-[var(--radius-card)] border border-line bg-surface">
          {rows.map(([k, v]) => (
            <div key={k} className="flex items-start justify-between gap-4 px-4 py-3.5">
              <dt className="text-[14px] text-muted">{k}</dt>
              <dd className="text-right text-[15px] font-semibold break-words text-ink">{v}</dd>
            </div>
          ))}
        </dl>
      </Section>
      <Section>
        <TransactionActions id={t.id} />
      </Section>
    </>
  );
}

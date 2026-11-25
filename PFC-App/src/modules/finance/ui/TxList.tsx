import Link from "next/link";
import { formatVnd } from "@/lib/money";
import { dayHeading, todayLocal } from "../domain/dates";
import type { Transaction } from "../server/queries";
import { CategoryBadge } from "./CategoryIcon";

export function signedAmount(t: Pick<Transaction, "type" | "amount">): string {
  return `${t.type === "income" ? "+" : "−"}${formatVnd(t.amount)}`;
}

export function TxRow({ t }: { t: Transaction }) {
  return (
    <li>
      <Link
        href={`/finance/transactions/${t.id}`}
        className="pressable flex items-center gap-3 px-4 py-3 active:bg-surface-2"
      >
        <CategoryBadge icon={t.categoryIcon} type={t.type} />
        <span className="min-w-0 flex-1">
          <span className="block truncate text-[15px] font-semibold text-ink">{t.note || t.categoryName}</span>
          <span className="block truncate text-[13px] text-muted">{t.categoryName}</span>
        </span>
        <span className="text-right">
          <span className={`block text-[15px] font-bold ${t.type === "income" ? "text-income" : "text-expense"}`}>
            {signedAmount(t)}
          </span>
          <span className="block text-[12px] text-muted">{t.occurredAt.slice(11, 16)}</span>
        </span>
      </Link>
    </li>
  );
}

/** Transactions grouped by day with "Hôm nay / Hôm qua" headings (mockup 21/29). */
export function GroupedTxList({ transactions }: { transactions: Transaction[] }) {
  const today = todayLocal();
  const groups = new Map<string, Transaction[]>();
  for (const t of transactions) {
    const day = t.occurredAt.slice(0, 10);
    groups.set(day, [...(groups.get(day) ?? []), t]);
  }
  return (
    <div className="space-y-4">
      {[...groups.entries()].map(([day, list]) => (
        <section key={day}>
          <h3 className="mb-2 px-1 text-[13px] font-semibold text-muted">{dayHeading(day, today)}</h3>
          <ul className="divide-y divide-line overflow-hidden rounded-[var(--radius-card)] border border-line bg-surface">
            {list.map((t) => (
              <TxRow key={t.id} t={t} />
            ))}
          </ul>
        </section>
      ))}
    </div>
  );
}

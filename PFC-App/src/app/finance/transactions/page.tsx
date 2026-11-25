import { ReceiptText } from "lucide-react";
import { requireMember } from "@/platform/auth/session";
import { formatVnd } from "@/lib/money";
import { totals } from "@/modules/finance/domain/analytics";
import { monthRange } from "@/modules/finance/domain/dates";
import { listTransactions } from "@/modules/finance/server/queries";
import { FilterChips } from "@/ui/FilterChips";
import { MonthSwitcher } from "@/modules/finance/ui/MonthSwitcher";
import { SearchBox } from "@/ui/SearchBox";
import { GroupedTxList } from "@/modules/finance/ui/TxList";
import { firstParam, monthParam } from "@/modules/finance/ui/page-params";
import { AppHeader, ButtonLink, EmptyState } from "@/ui";

export const metadata = { title: "Giao dịch" };

/** FIN-04 Transaction History (mockup 21 / 29): month, type filter, search. */
export default async function TransactionsPage({ searchParams }: { searchParams: Promise<Record<string, string>> }) {
  const me = await requireMember("/finance/transactions");
  const sp = await searchParams;
  const month = monthParam(sp.month);
  const typeParam = firstParam(sp.type);
  const type = typeParam === "income" || typeParam === "expense" ? typeParam : undefined;
  const q = firstParam(sp.q)?.slice(0, 80);
  const txs = await listTransactions(me.id, { ...monthRange(month), type, q, limit: 2000 });
  const sum = totals(txs);
  const href = (t: string) => {
    const p = new URLSearchParams({ month });
    if (t !== "all") p.set("type", t);
    if (q) p.set("q", q);
    return `/finance/transactions?${p.toString()}`;
  };

  return (
    <>
      <AppHeader title="Giao dịch" backHref="/finance" />
      <div className="space-y-3 px-4">
        <SearchBox placeholder="Tìm theo ghi chú hoặc danh mục…" />
        <FilterChips
          label="Lọc theo loại"
          value={type ?? "all"}
          hrefFor={href}
          options={[
            { value: "all", label: "Tất cả" },
            { value: "income", label: "Thu nhập" },
            { value: "expense", label: "Chi tiêu" },
          ]}
        />
        <MonthSwitcher month={month} basePath="/finance/transactions" params={{ type, q }} />
        <div className="grid grid-cols-2 gap-3 text-center">
          <div className="rounded-2xl bg-income-soft px-3 py-2">
            <p className="text-[12px] text-ink-2">Thu</p>
            <p className="text-[15px] font-bold text-income">+{formatVnd(sum.income)}</p>
          </div>
          <div className="rounded-2xl bg-expense-soft px-3 py-2">
            <p className="text-[12px] text-ink-2">Chi</p>
            <p className="text-[15px] font-bold text-expense">−{formatVnd(sum.expense)}</p>
          </div>
        </div>
      </div>
      <div className="px-4 pt-4">
        {txs.length === 0 ? (
          <EmptyState
            icon={ReceiptText}
            title={q ? "Không tìm thấy giao dịch" : "Chưa có giao dịch"}
            description={q ? `Không có kết quả cho “${q}” trong tháng này.` : "Bấm nút + để ghi khoản thu chi đầu tiên."}
            action={
              !q && (
                <ButtonLink href="/finance/transactions/new" block>
                  Thêm giao dịch
                </ButtonLink>
              )
            }
          />
        ) : (
          <GroupedTxList transactions={txs} />
        )}
      </div>
    </>
  );
}

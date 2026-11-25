import { requireMember } from "@/platform/auth/session";
import { nowLocal } from "@/modules/finance/domain/dates";
import { listCategories } from "@/modules/finance/server/queries";
import { TransactionForm } from "@/modules/finance/ui/TransactionForm";
import { AppHeader } from "@/ui";

export const metadata = { title: "Thêm giao dịch" };

export default async function NewTransactionPage() {
  const me = await requireMember("/finance/transactions/new");
  const categories = await listCategories(me.id);
  return (
    <>
      <AppHeader back backFallback="/finance" title="Thêm giao dịch" />
      <TransactionForm categories={categories} defaultOccurredAt={nowLocal()} />
    </>
  );
}

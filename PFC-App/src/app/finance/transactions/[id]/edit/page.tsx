import { notFound } from "next/navigation";
import { requireMember } from "@/platform/auth/session";
import { nowLocal } from "@/modules/finance/domain/dates";
import { getTransaction, listCategories } from "@/modules/finance/server/queries";
import { TransactionForm } from "@/modules/finance/ui/TransactionForm";
import { AppHeader } from "@/ui";

export const metadata = { title: "Sửa giao dịch" };

export default async function EditTransactionPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const me = await requireMember(`/finance/transactions/${id}/edit`);
  const [t, categories] = await Promise.all([getTransaction(me.id, id), listCategories(me.id, { includeArchived: true })]);
  if (!t) notFound();
  return (
    <>
      <AppHeader back backFallback={`/finance/transactions/${id}`} title="Sửa giao dịch" />
      <TransactionForm
        txId={t.id}
        categories={categories}
        defaultOccurredAt={nowLocal()}
        initial={{ type: t.type, amount: t.amount, categoryId: t.categoryId, occurredAt: t.occurredAt, note: t.note }}
      />
    </>
  );
}

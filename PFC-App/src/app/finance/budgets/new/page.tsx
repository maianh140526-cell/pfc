import { requireMember } from "@/platform/auth/session";
import { budgetsForMonth, listCategories } from "@/modules/finance/server/queries";
import { monthParam } from "@/modules/finance/ui/page-params";
import { AppHeader } from "@/ui";
import { BudgetForm } from "./BudgetForm";

export const metadata = { title: "Lập ngân sách" };

/** FIN-10 Create Budget (mockup 26 / 110). Also edits existing limits for the month. */
export default async function NewBudgetPage({ searchParams }: { searchParams: Promise<Record<string, string>> }) {
  const me = await requireMember("/finance/budgets/new");
  const month = monthParam((await searchParams).month);
  const [categories, existing] = await Promise.all([listCategories(me.id), budgetsForMonth(me.id, month)]);
  return (
    <>
      <AppHeader back backFallback={`/finance/budgets?month=${month}`} title="Lập ngân sách" />
      <BudgetForm
        month={month}
        categories={categories.filter((c) => c.type === "expense")}
        existing={existing.map((b) => ({ categoryId: b.categoryId, limit: b.limit }))}
      />
    </>
  );
}

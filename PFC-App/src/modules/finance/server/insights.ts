import "server-only";
import { insights, type Insight } from "../domain/insights";
import { shiftMonth, todayLocal } from "../domain/dates";
import { budgetsForMonth, categorySlices, listCategories, listGoals, monthOverview } from "./queries";

/** Builds the insight input from the member's own data only (BR-009). */
export async function insightsFor(memberId: string, month: string): Promise<Insight[]> {
  const today = todayLocal();
  const [ov, prevOv, categories, budgets, goals] = await Promise.all([
    monthOverview(memberId, month),
    monthOverview(memberId, shiftMonth(month, -1)),
    listCategories(memberId, { includeArchived: true }),
    budgetsForMonth(memberId, month),
    listGoals(memberId),
  ]);
  const cur = categorySlices(ov.transactions, "expense", categories, 50);
  const prev = new Map(categorySlices(prevOv.transactions, "expense", categories, 50).map((s) => [s.name, s.amount]));
  const [y, m] = month.split("-").map(Number);
  const daysInMonth = new Date(Date.UTC(y, m, 0)).getUTCDate();
  const isCurrent = today.startsWith(month);
  return insights({
    month,
    dayOfMonth: isCurrent ? Number(today.slice(8, 10)) : daysInMonth,
    daysInMonth,
    income: ov.totals.income,
    expense: ov.totals.expense,
    prevIncome: ov.previous.income,
    prevExpense: ov.previous.expense,
    categories: cur.map((c) => ({ name: c.name, amount: c.amount, prevAmount: prev.get(c.name) ?? 0 })),
    budgets: budgets.map((b) => ({ name: b.categoryName, limit: b.limit, spent: b.spent })),
    goals: goals.map((g) => ({ name: g.name, target: g.target, current: g.current, deadline: g.deadline || null })),
    today,
  });
}

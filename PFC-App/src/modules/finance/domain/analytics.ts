import type { TxType } from "./categories";
import { monthKeyOf } from "./dates";

export type TxLite = { type: TxType; amount: number; categoryId: string; occurredAt: string };

export function totals(txs: readonly TxLite[]): { income: number; expense: number; net: number } {
  let income = 0;
  let expense = 0;
  for (const t of txs) {
    if (t.type === "income") income += t.amount;
    else expense += t.amount;
  }
  return { income, expense, net: income - expense };
}

export type CategorySlice = { categoryId: string | null; amount: number; share: number };

/**
 * Amount per category for one type, largest first. Beyond `maxSlices` the tail is folded
 * into one "Khác" slice (categoryId null) — charts never cycle colours (dataviz rule).
 */
export function byCategory(txs: readonly TxLite[], type: TxType, maxSlices = 5): CategorySlice[] {
  const sums = new Map<string, number>();
  for (const t of txs) if (t.type === type) sums.set(t.categoryId, (sums.get(t.categoryId) ?? 0) + t.amount);
  const total = [...sums.values()].reduce((a, b) => a + b, 0);
  if (total === 0) return [];
  const sorted = [...sums.entries()].sort((a, b) => b[1] - a[1]);
  const head = sorted.slice(0, maxSlices).map(([categoryId, amount]) => ({ categoryId, amount, share: amount / total }));
  const tailAmount = sorted.slice(maxSlices).reduce((a, [, v]) => a + v, 0);
  return tailAmount > 0 ? [...head, { categoryId: null, amount: tailAmount, share: tailAmount / total }] : head;
}

/** Monthly income/expense for the given month keys (oldest first), zero-filled. */
export function monthlySeries(txs: readonly TxLite[], months: readonly string[]) {
  const map = new Map(months.map((m) => [m, { month: m, income: 0, expense: 0 }]));
  for (const t of txs) {
    const row = map.get(monthKeyOf(t.occurredAt));
    if (row) row[t.type] += t.amount;
  }
  return months.map((m) => map.get(m)!);
}

/** Percentage change, or null when there is no baseline to compare against. */
export function changePct(current: number, previous: number): number | null {
  if (previous === 0) return null;
  return ((current - previous) / previous) * 100;
}

export function budgetUsage(spent: number, limit: number) {
  const pct = limit > 0 ? (spent / limit) * 100 : 0;
  return {
    pct,
    remaining: limit - spent,
    state: pct > 100 ? ("over" as const) : pct >= 80 ? ("warning" as const) : ("ok" as const),
  };
}

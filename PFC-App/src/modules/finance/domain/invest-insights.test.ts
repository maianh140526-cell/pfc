import { describe, expect, it } from "vitest";
import { insights, type InsightInput } from "./insights";
import { holdingValue, portfolio } from "./invest";

describe("portfolio", () => {
  it("values holdings at the member's prices", () => {
    expect(holdingValue({ kind: "stock", quantity: 100, avgCost: 20_000, currentPrice: 25_000 })).toEqual({ cost: 2_000_000, value: 2_500_000, gain: 500_000, gainPct: 25 });
    const p = portfolio([
      { kind: "stock", quantity: 100, avgCost: 20_000, currentPrice: 25_000 },
      { kind: "gold", quantity: 1, avgCost: 8_000_000, currentPrice: 7_500_000 },
    ]);
    expect(p.value).toBe(10_000_000);
    expect(p.gain).toBe(0);
    expect(p.allocation[0]).toMatchObject({ kind: "gold", share: 0.75 });
  });
});

const base: InsightInput = { month: "2026-11", dayOfMonth: 20, daysInMonth: 30, income: 10_000_000, expense: 6_000_000, prevIncome: 10_000_000, prevExpense: 5_000_000, categories: [], budgets: [], goals: [], today: "2026-11-20" };

describe("insights", () => {
  it("explains savings, pace, rising categories and budgets with the numbers", () => {
    const r = insights({ ...base, categories: [{ name: "Ăn uống", amount: 3_000_000, prevAmount: 2_000_000 }], budgets: [{ name: "Ăn uống", limit: 2_500_000, spent: 3_000_000 }] });
    const ids = r.map((x) => x.id);
    expect(ids).toContain("saving-good"); // 4M kept of 10M = 40%
    expect(ids).toContain("pace");
    expect(ids).toContain("rise-Ăn uống");
    expect(ids).toContain("budget-over");
  });
  it("handles empty months and overspending", () => {
    expect(insights({ ...base, income: 0, expense: 0 })[0].id).toBe("empty");
    expect(insights({ ...base, income: 1_000_000, expense: 2_000_000 })[0].id).toBe("overspend");
    expect(insights({ ...base, expense: 5_000_000, dayOfMonth: 30 })[0].id).toBe("saving-good");
  });
});

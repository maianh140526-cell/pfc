import { describe, expect, it } from "vitest";
import { budgetUsage, byCategory, changePct, monthlySeries, totals } from "./analytics";
import { challengeProgress, evaluateChallengeStatus } from "./challenge";
import { parseCsv, toCsv, validateImport } from "./csv";
import { dayHeading, daysBetween, monthRange, nowLocal, periodRange, shiftMonth } from "./dates";
import { compoundValue, loanSchedule, personalIncomeTax, requiredReturn, retirementFutureValue } from "./tools";

describe("dates (Vietnam local time)", () => {
  it("converts UTC to UTC+7", () => {
    expect(nowLocal(new Date("2026-09-30T18:30:00Z"))).toBe("2026-10-01T01:30");
  });
  it("shifts months across years", () => {
    expect(shiftMonth("2026-12", 1)).toBe("2027-01");
    expect(shiftMonth("2026-01", -1)).toBe("2025-12");
  });
  it("builds half-open month, quarter and year ranges", () => {
    expect(monthRange("2026-09")).toEqual({ start: "2026-09-01T00:00", end: "2026-10-01T00:00" });
    expect(periodRange("quarter", "2026-08").months).toEqual(["2026-07", "2026-08", "2026-09"]);
    expect(periodRange("year", "2026-08").end).toBe("2027-01-01T00:00");
  });
  it("labels today / yesterday", () => {
    expect(dayHeading("2026-09-15", "2026-09-15")).toBe("Hôm nay, 15/09/2026");
    expect(dayHeading("2026-09-14", "2026-09-15")).toBe("Hôm qua, 14/09/2026");
    expect(dayHeading("2026-03-01", "2026-03-02")).toBe("Hôm qua, 01/03/2026");
    expect(daysBetween("2026-09-15", "2026-10-15")).toBe(30);
  });
});

describe("analytics", () => {
  const tx = (type: "income" | "expense", amount: number, categoryId: string, occurredAt = "2026-09-10T10:00") => ({
    type,
    amount,
    categoryId,
    occurredAt,
  });
  it("totals income, expense and net", () => {
    expect(totals([tx("income", 100, "a"), tx("expense", 30, "b")])).toEqual({ income: 100, expense: 30, net: 70 });
  });
  it("folds the tail into one 'other' slice", () => {
    const txs = ["a", "b", "c", "d"].map((c, i) => tx("expense", 40 - i * 10, c));
    const slices = byCategory(txs, "expense", 2);
    expect(slices.map((s) => s.categoryId)).toEqual(["a", "b", null]);
    expect(slices[2].amount).toBe(30);
    expect(slices.reduce((a, s) => a + s.share, 0)).toBeCloseTo(1);
  });
  it("zero-fills monthly series", () => {
    const s = monthlySeries([tx("income", 5, "a", "2026-08-02T00:00")], ["2026-07", "2026-08"]);
    expect(s).toEqual([
      { month: "2026-07", income: 0, expense: 0 },
      { month: "2026-08", income: 5, expense: 0 },
    ]);
  });
  it("reports change and budget state", () => {
    expect(changePct(110, 100)).toBeCloseTo(10);
    expect(changePct(5, 0)).toBeNull();
    expect(budgetUsage(85, 100).state).toBe("warning");
    expect(budgetUsage(101, 100).state).toBe("over");
  });
});

describe("saving challenges", () => {
  const base = { targetAmount: 1000, durationDays: 7 };
  it("keeps a saving challenge active below target until the last day (upstream bug fixed)", () => {
    expect(evaluateChallengeStatus({ ...base, challengeType: "saving", progressAmount: 100, checkedDays: 1 })).toBe("active");
    expect(evaluateChallengeStatus({ ...base, challengeType: "saving", progressAmount: 999, checkedDays: 7 })).toBe("failed");
    expect(evaluateChallengeStatus({ ...base, challengeType: "saving", progressAmount: 1000, checkedDays: 7 })).toBe("success");
  });
  it("fails a spending limit as soon as it is exceeded", () => {
    expect(evaluateChallengeStatus({ ...base, challengeType: "spending_limit", progressAmount: 1001, checkedDays: 1 })).toBe("failed");
    expect(evaluateChallengeStatus({ ...base, challengeType: "spending_limit", progressAmount: 900, checkedDays: 7 })).toBe("success");
  });
  it("computes progress by challenge type", () => {
    const txs = [
      { type: "income" as const, amount: 500 },
      { type: "expense" as const, amount: 200 },
    ];
    expect(challengeProgress("saving", txs)).toBe(300);
    expect(challengeProgress("spending_limit", txs)).toBe(200);
  });
});

describe("calculators (match PFC Quỹ formulas)", () => {
  it("compound interest with and without rate", () => {
    expect(compoundValue(1000, 0, 1, 100)).toBe(2200);
    expect(compoundValue(10_000_000, 12, 1, 0)).toBeCloseTo(11_268_250.3, 0);
  });
  it("loan schedule pays off exactly", () => {
    const s = loanSchedule(12_000_000, 12, 12);
    expect(s.payment).toBeCloseTo(1_066_185.5, 0);
    expect(s.rows.at(-1)!.balance).toBe(0);
    expect(s.rows.reduce((a, r) => a + r.principal, 0)).toBeCloseTo(12_000_000, 3);
  });
  it("personal income tax uses the 5-bracket table", () => {
    const r = personalIncomeTax(35_500_000, 0, 0); // taxable 20M
    expect(r.taxable).toBe(20_000_000);
    expect(r.tax).toBe(1_500_000); // 10M×5% + 10M×10%
    expect(personalIncomeTax(10_000_000, 1, 0).tax).toBe(0);
  });
  it("retirement solver is consistent with the forward formula", () => {
    const rate = requiredReturn(5_000_000_000, 100_000_000, 5_000_000, 25);
    expect(retirementFutureValue(100_000_000, 5_000_000, rate, 25)).toBeGreaterThanOrEqual(5_000_000_000);
    expect(requiredReturn(1, 10, 0, 5)).toBe(0);
  });
});

describe("CSV", () => {
  it("round-trips through export and import, neutralising formulas", () => {
    const csv = toCsv([
      { occurredAt: "2026-09-15T10:24", type: "expense", amount: 65000, category: "Ăn uống", note: '=HYPERLINK("x"), "hi"' },
    ]);
    expect(csv.startsWith("﻿")).toBe(true);
    expect(parseCsv(csv)[1][4]).toBe(`'=HYPERLINK("x"), "hi"`);
    const { rows, errors } = validateImport(csv);
    expect(errors).toEqual([]);
    expect(rows[0]).toMatchObject({ occurredAt: "2026-09-15T10:24", amount: 65000, category: "Ăn uống" });
    expect(rows[0].note).toBe('=HYPERLINK("x"), "hi"');
  });
  it("reports line-level errors", () => {
    const { rows, errors } = validateImport("date,type,amount,category\n2026-13-45,expense,10,A\n2026-09-01,gift,10,A\n2026-09-01,income,-5,A\n2026-09-01,income,5,A");
    expect(rows).toHaveLength(1);
    expect(errors.map((e) => e.line)).toEqual([2, 3, 4]);
  });
});

/**
 * Financial calculators ported from PFC Quỹ. Reference only — not financial, investment
 * or tax advice (SRS Q16; disclaimer shown on every tool screen).
 */

/** compound_interest_screen.dart: monthly compounding + monthly contribution. */
export function compoundValue(principal: number, annualRatePct: number, years: number, monthly: number): number {
  const months = years * 12;
  const r = annualRatePct / 100 / 12;
  if (r === 0) return principal + monthly * months;
  const f = (1 + r) ** months;
  return principal * f + (monthly * (f - 1)) / r;
}

export function compoundTable(principal: number, annualRatePct: number, years: number, monthly: number) {
  return Array.from({ length: years }, (_, i) => {
    const year = i + 1;
    const value = compoundValue(principal, annualRatePct, year, monthly);
    const contributed = principal + monthly * 12 * year;
    return { year, value, contributed, interest: value - contributed };
  });
}

/** loan_calculator_screen.dart: equal monthly payment (annuity) with amortisation schedule. */
export function loanSchedule(principal: number, annualRatePct: number, months: number) {
  const r = annualRatePct / 100 / 12;
  const payment = r === 0 ? principal / months : (principal * (r * (1 + r) ** months)) / ((1 + r) ** months - 1);
  let balance = principal;
  let totalInterest = 0;
  const rows: Array<{ month: number; payment: number; principal: number; interest: number; balance: number }> = [];
  for (let month = 1; month <= months; month++) {
    const interest = balance * r;
    let principalPaid = payment - interest;
    if (month === months || principalPaid > balance) principalPaid = balance;
    balance = Math.max(0, balance - principalPaid);
    totalInterest += interest;
    rows.push({ month, payment: principalPaid + interest, principal: principalPaid, interest, balance });
  }
  return { payment, totalInterest, totalPaid: principal + totalInterest, rows };
}

/** personal_income_tax_screen.dart: deductions and 5-bracket progressive table as in upstream. */
export const PIT_PERSONAL_DEDUCTION = 15_500_000;
export const PIT_DEPENDENT_DEDUCTION = 6_200_000;
const PIT_BRACKETS = [
  { upTo: 10_000_000, rate: 0.05, label: "Đến 10 triệu" },
  { upTo: 30_000_000, rate: 0.1, label: "Trên 10–30 triệu" },
  { upTo: 60_000_000, rate: 0.2, label: "Trên 30–60 triệu" },
  { upTo: 100_000_000, rate: 0.3, label: "Trên 60–100 triệu" },
  { upTo: Infinity, rate: 0.35, label: "Trên 100 triệu" },
];

export function personalIncomeTax(monthlyIncome: number, dependents: number, insurance: number) {
  const taxable = Math.max(0, monthlyIncome - PIT_PERSONAL_DEDUCTION - dependents * PIT_DEPENDENT_DEDUCTION - insurance);
  let lower = 0;
  let tax = 0;
  const details: Array<{ label: string; rate: number; taxable: number; tax: number }> = [];
  for (const b of PIT_BRACKETS) {
    if (taxable <= lower) break;
    const amount = Math.min(taxable, b.upTo) - lower;
    details.push({ label: b.label, rate: b.rate, taxable: amount, tax: amount * b.rate });
    tax += amount * b.rate;
    lower = b.upTo;
  }
  return { taxable, tax, net: monthlyIncome - insurance - tax, details };
}

/** retirement_plan_screen.dart */
export function retirementFutureValue(currentSavings: number, monthly: number, annualRatePct: number, years: number) {
  if (years <= 0) return currentSavings;
  const r = annualRatePct / 100;
  if (r === 0) return currentSavings + monthly * 12 * years;
  const f = (1 + r) ** years;
  return currentSavings * f + monthly * 12 * ((f - 1) / r);
}

/** 25× annual spending (4% rule), inflated to the retirement year. */
export function retirementTarget(monthlyBudget: number, inflationPct: number, years: number) {
  return monthlyBudget * 12 * 25 * (1 + inflationPct / 100) ** years;
}

/** Annual return needed to reach the target; Infinity if even 50%/yr is not enough. */
export function requiredReturn(target: number, currentSavings: number, monthly: number, years: number): number {
  if (years <= 0 || target <= 0) return 0;
  const fv = (r: number) => retirementFutureValue(currentSavings, monthly, r, years);
  if (fv(0) >= target) return 0;
  if (fv(50) < target) return Infinity;
  let lo = 0;
  let hi = 50;
  for (let i = 0; i < 80; i++) {
    const mid = (lo + hi) / 2;
    if (fv(mid) >= target) hi = mid;
    else lo = mid;
  }
  return hi;
}

export function requiredMonthly(target: number, currentSavings: number, annualRatePct: number, years: number): number {
  if (years <= 0 || target <= currentSavings) return 0;
  let lo = 0;
  let hi = target / 12;
  for (let i = 0; i < 80; i++) {
    const mid = (lo + hi) / 2;
    if (retirementFutureValue(currentSavings, mid, annualRatePct, years) >= target) hi = mid;
    else lo = mid;
  }
  return hi;
}

/** data/bank_rates.dart — static reference rates, 09/2026. Not live data. */
export const BANK_RATES_AS_OF = "09/2026";
export const BANK_RATES: ReadonlyArray<{ bank: string; m3: number; m6: number; m12: number }> = [
  { bank: "Vietcombank", m3: 4.75, m6: 6.6, m12: 6.8 },
  { bank: "BIDV", m3: 4.75, m6: 6.6, m12: 6.8 },
  { bank: "VietinBank", m3: 4.75, m6: 6.6, m12: 6.8 },
  { bank: "Agribank", m3: 4.75, m6: 6.6, m12: 6.8 },
  { bank: "ACB", m3: 4.75, m6: 7.6, m12: 7.8 },
  { bank: "Sacombank", m3: 4.75, m6: 7.2, m12: 7.5 },
  { bank: "Techcombank", m3: 4.7, m6: 6.5, m12: 6.8 },
  { bank: "MB", m3: 4.7, m6: 6.5, m12: 6.8 },
  { bank: "VPBank", m3: 4.7, m6: 6.5, m12: 6.8 },
];

/** Simple (non-compounded) interest for a fixed term deposit. */
export function depositInterest(amount: number, annualRatePct: number, months: number): number {
  return (amount * annualRatePct * months) / 100 / 12;
}

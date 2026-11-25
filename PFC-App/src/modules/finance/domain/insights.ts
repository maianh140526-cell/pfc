/**
 * Financial insights ("Gợi ý tài chính"). Pure, rule-based and explainable: every insight states the numbers it
 * comes from. No advice on specific investments (PFC is not a licensed advisor).
 */
export type Insight = { id: string; tone: "good" | "warn" | "info"; title: string; body: string; href?: string };

export type InsightInput = {
  month: string; // YYYY-MM
  dayOfMonth: number; // today's day if month is current, else days in month
  daysInMonth: number;
  income: number;
  expense: number;
  prevIncome: number;
  prevExpense: number;
  categories: { name: string; amount: number; prevAmount: number }[]; // expense per category
  budgets: { name: string; limit: number; spent: number }[];
  goals: { name: string; target: number; current: number; deadline: string | null }[];
  today: string; // YYYY-MM-DD
};

const vnd = (n: number) => `${new Intl.NumberFormat("vi-VN").format(Math.round(n))}₫`;

export function insights(x: InsightInput): Insight[] {
  const out: Insight[] = [];
  if (x.income === 0 && x.expense === 0) {
    return [{ id: "empty", tone: "info", title: "Chưa có dữ liệu tháng này", body: "Ghi lại thu chi vài ngày để nhận gợi ý dựa trên chính số liệu của bạn.", href: "/finance/transactions/new" }];
  }
  // Savings rate.
  if (x.income > 0) {
    const rate = (x.income - x.expense) / x.income;
    if (rate < 0) out.push({ id: "overspend", tone: "warn", title: "Chi nhiều hơn thu", body: `Tháng này bạn chi ${vnd(x.expense)}, vượt thu nhập ${vnd(x.expense - x.income)}.` });
    else if (rate >= 0.2) out.push({ id: "saving-good", tone: "good", title: `Tiết kiệm được ${Math.round(rate * 100)}% thu nhập`, body: `Bạn giữ lại ${vnd(x.income - x.expense)} trong tháng. Có thể chuyển một phần vào mục tiêu tiết kiệm.`, href: "/finance/goals" });
    else out.push({ id: "saving-low", tone: "info", title: `Tỷ lệ tiết kiệm ${Math.round(rate * 100)}%`, body: `Thu ${vnd(x.income)}, chi ${vnd(x.expense)}. Đặt ngân sách cho các danh mục chi lớn để giữ lại nhiều hơn.`, href: "/finance/budgets" });
  }
  // Pace: projected month-end spending vs last month.
  if (x.dayOfMonth < x.daysInMonth && x.dayOfMonth >= 5 && x.prevExpense > 0) {
    const projected = (x.expense / x.dayOfMonth) * x.daysInMonth;
    if (projected > x.prevExpense * 1.15) {
      out.push({ id: "pace", tone: "warn", title: "Đà chi tiêu cao hơn tháng trước", body: `Với tốc độ hiện tại, cả tháng ước khoảng ${vnd(projected)} so với ${vnd(x.prevExpense)} tháng trước.` });
    }
  }
  // Biggest category increase (at least +30% and +200.000₫).
  const rising = x.categories
    .filter((c) => c.prevAmount > 0 && c.amount - c.prevAmount >= 200_000 && c.amount >= c.prevAmount * 1.3)
    .sort((a, b) => b.amount - b.prevAmount - (a.amount - a.prevAmount))[0];
  if (rising) {
    out.push({ id: `rise-${rising.name}`, tone: "warn", title: `“${rising.name}” tăng ${Math.round(((rising.amount - rising.prevAmount) / rising.prevAmount) * 100)}%`, body: `${vnd(rising.amount)} tháng này, ${vnd(rising.prevAmount)} tháng trước.`, href: "/finance/overview/expense" });
  }
  // Top category share.
  const top = [...x.categories].sort((a, b) => b.amount - a.amount)[0];
  if (top && x.expense > 0 && top.amount / x.expense >= 0.4) {
    out.push({ id: "top-share", tone: "info", title: `“${top.name}” chiếm ${Math.round((top.amount / x.expense) * 100)}% chi tiêu`, body: `${vnd(top.amount)} trên tổng ${vnd(x.expense)}.` });
  }
  // Budgets.
  const over = x.budgets.filter((b) => b.limit > 0 && b.spent > b.limit);
  const near = x.budgets.filter((b) => b.limit > 0 && b.spent <= b.limit && b.spent >= b.limit * 0.8);
  if (over.length) out.push({ id: "budget-over", tone: "warn", title: `Vượt ngân sách ${over.length} danh mục`, body: over.map((b) => `${b.name}: ${vnd(b.spent)}/${vnd(b.limit)}`).join(" · "), href: "/finance/budgets" });
  else if (near.length) out.push({ id: "budget-near", tone: "info", title: `Sắp chạm ngân sách`, body: near.map((b) => `${b.name}: ${Math.round((b.spent / b.limit) * 100)}%`).join(" · "), href: "/finance/budgets" });
  else if (x.budgets.length === 0 && x.expense > 0) out.push({ id: "budget-none", tone: "info", title: "Chưa đặt ngân sách", body: "Đặt hạn mức cho 2–3 danh mục chi lớn nhất để được nhắc khi sắp vượt.", href: "/finance/budgets" });
  // Goals with deadlines.
  for (const g of x.goals) {
    if (!g.deadline || g.current >= g.target) continue;
    const days = Math.round((Date.parse(g.deadline) - Date.parse(x.today)) / 86_400_000);
    if (days <= 0) continue;
    const perMonth = ((g.target - g.current) / days) * 30;
    if (days <= 120) out.push({ id: `goal-${g.name}`, tone: "info", title: `Mục tiêu “${g.name}”`, body: `Còn ${vnd(g.target - g.current)} trong ${days} ngày — khoảng ${vnd(perMonth)} mỗi tháng.`, href: "/finance/goals" });
  }
  return out.slice(0, 6);
}

"use client";

import { LayoutGrid, LayoutDashboard, PieChart, Plus, ReceiptText } from "lucide-react";
import { HubTabBar, type HubTab } from "@/ui/HubTabBar";

const TABS: readonly HubTab[] = [
  { href: "/finance", label: "Tổng quan", icon: LayoutDashboard, exact: true },
  { href: "/finance/transactions", label: "Giao dịch", icon: ReceiptText },
  { href: "/finance/transactions/new", label: "Thêm giao dịch", icon: Plus, primary: true },
  { href: "/finance/budgets", label: "Ngân sách", icon: PieChart },
  {
    href: "/finance/more",
    label: "Tiện ích",
    icon: LayoutGrid,
    match: ["/finance/goals", "/finance/challenges", "/finance/reports", "/finance/tools", "/finance/categories", "/finance/data", "/finance/overview", "/finance/invest", "/finance/insights", "/finance/places"],
  },
];

export function FinanceTabBar() {
  return <HubTabBar tabs={TABS} label="Điều hướng Tài chính" />;
}

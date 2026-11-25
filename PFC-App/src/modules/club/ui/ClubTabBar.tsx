"use client";

import { CalendarDays, KanbanSquare, LayoutDashboard, Menu, Users } from "lucide-react";
import { HubTabBar, type HubTab } from "@/ui/HubTabBar";

const TABS: readonly HubTab[] = [
  { href: "/club", label: "Tổng quan", icon: LayoutDashboard, exact: true },
  { href: "/club/tasks", label: "Công việc", icon: KanbanSquare },
  { href: "/club/members", label: "Thành viên", icon: Users },
  { href: "/club/activities", label: "Hoạt động", icon: CalendarDays },
  { href: "/club/more", label: "Thêm", icon: Menu, match: ["/club/manage", "/club/notifications", "/club/report", "/club/documents"] },
];

export function ClubTabBar() {
  return <HubTabBar tabs={TABS} label="Điều hướng Câu lạc bộ" />;
}

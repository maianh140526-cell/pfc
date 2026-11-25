"use client";

import { Bell, Bookmark, Compass, Send, UserRound } from "lucide-react";
import { HubTabBar, type HubTab } from "@/ui/HubTabBar";

const TABS: readonly HubTab[] = [
  { href: "/opportunities", label: "Khám phá", icon: Compass, exact: true, match: [] },
  { href: "/opportunities/saved", label: "Đã lưu", icon: Bookmark },
  { href: "/opportunities/applications", label: "Ứng tuyển", icon: Send },
  { href: "/opportunities/notifications", label: "Thông báo", icon: Bell },
  { href: "/opportunities/account", label: "Tài khoản", icon: UserRound, match: ["/opportunities/provider", "/opportunities/review"] },
];

export function OppTabBar() {
  return <HubTabBar tabs={TABS} label="Điều hướng Cơ hội" />;
}

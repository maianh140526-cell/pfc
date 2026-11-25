"use client";

import { BookOpen, ClipboardCheck, Compass, MessagesSquare, UserRound } from "lucide-react";
import { HubTabBar, type HubTab } from "@/ui/HubTabBar";

const TABS: readonly HubTab[] = [
  { href: "/learn", label: "Khám phá", icon: Compass, exact: true, match: ["/learn/resources"] },
  { href: "/learn/courses", label: "Khóa học", icon: BookOpen },
  { href: "/learn/quizzes", label: "Kiểm tra", icon: ClipboardCheck },
  { href: "/learn/forum", label: "Diễn đàn", icon: MessagesSquare },
  { href: "/learn/me", label: "Của tôi", icon: UserRound, match: ["/learn/manage"] },
];

export function EduTabBar() {
  return <HubTabBar tabs={TABS} label="Điều hướng Học tập" />;
}

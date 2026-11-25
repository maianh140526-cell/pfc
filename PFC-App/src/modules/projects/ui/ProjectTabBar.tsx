"use client";

import { Compass, FolderKanban, GraduationCap, Menu, PlusCircle } from "lucide-react";
import { HubTabBar, type HubTab } from "@/ui/HubTabBar";

const TABS: readonly HubTab[] = [
  { href: "/projects", label: "Khám phá", icon: Compass, exact: true, match: ["/projects/p"] },
  { href: "/projects/mine", label: "Của tôi", icon: FolderKanban },
  { href: "/projects/new", label: "Tạo dự án", icon: PlusCircle },
  { href: "/projects/mentors", label: "Mentor", icon: GraduationCap },
  { href: "/projects/more", label: "Thêm", icon: Menu, match: ["/projects/manage", "/projects/collab"] },
];

export function ProjectTabBar() {
  return <HubTabBar tabs={TABS} label="Điều hướng Dự án" />;
}

"use client";

import { ShieldAlert } from "lucide-react";
import { useClub } from "@/modules/club/session";
import { ActivityForm } from "@/modules/club/ui/ActivityForm";
import { AppHeader, EmptyState } from "@/ui";

/** FR-CLB-007 Create activity (manage_activities). */
export default function NewClubActivityPage() {
  const { can } = useClub();
  return (
    <>
      <AppHeader back backFallback="/club/activities" title="Tạo hoạt động" />
      {can("manage_activities") ? (
        <ActivityForm />
      ) : (
        <EmptyState icon={ShieldAlert} title="Bạn chưa có quyền tạo hoạt động" description="Ban điều hành và Ban Sự kiện tạo hoạt động của CLB." />
      )}
    </>
  );
}

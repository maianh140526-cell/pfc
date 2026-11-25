"use client";

import { useParams } from "next/navigation";
import { ShieldAlert } from "lucide-react";
import { useHub } from "@/platform/hub-proxy/client";
import { HubErrorState, ListSkeleton } from "@/platform/hub-proxy/HubStates";
import { CLUB_RUN_HINT, useClub } from "@/modules/club/session";
import type { Activity } from "@/modules/club/types";
import { ActivityForm, toLocal } from "@/modules/club/ui/ActivityForm";
import { AppHeader, EmptyState } from "@/ui";

/** Edit a Club activity (manage_activities). */
export default function EditClubActivityPage() {
  const { id } = useParams<{ id: string }>();
  const { can } = useClub();
  const { data, error, loading, reload } = useHub<{ activity: Activity }>("club", `?action=activity&activityId=${encodeURIComponent(id)}`);
  if (!can("manage_activities")) {
    return (
      <>
        <AppHeader back backFallback={`/club/activities/${id}`} title="Sửa hoạt động" />
        <EmptyState icon={ShieldAlert} title="Bạn chưa có quyền sửa hoạt động" />
      </>
    );
  }
  if (loading && !data) return <ListSkeleton rows={3} />;
  if (error || !data) {
    return (
      <>
        <AppHeader back backFallback={`/club/activities/${id}`} title="Sửa hoạt động" />
        {error && <HubErrorState error={error} onRetry={reload} hubName="Câu lạc bộ" runHint={CLUB_RUN_HINT} />}
      </>
    );
  }
  const a = data.activity;
  const cover = a.coverUrl ? [a.coverUrl] : [];
  return (
    <>
      <AppHeader back backFallback={`/club/activities/${id}`} title="Sửa hoạt động" />
      <ActivityForm
        id={a.id}
        initial={{
          title: a.title,
          description: a.description ?? "",
          bodyMd: a.bodyMd && a.bodyMd !== a.description ? a.bodyMd : "",
          mode: (a.mode as "offline" | "online" | "hybrid") ?? "offline",
          location: a.location ?? "",
          startsAt: toLocal(a.startsAt),
          endsAt: toLocal(a.endsAt),
          registerDeadline: toLocal(a.registerDeadline),
          capacity: a.capacity ? String(a.capacity) : "",
          hostTeamId: a.hostTeamId ?? "",
          cover,
          photos: (a.mediaUrls ?? []).filter((u) => !cover.includes(u)),
        }}
      />
    </>
  );
}

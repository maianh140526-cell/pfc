"use client";

import Link from "next/link";
import { BellRing } from "lucide-react";
import { useHub } from "@/platform/hub-proxy/client";
import { HubErrorState, ListSkeleton } from "@/platform/hub-proxy/HubStates";
import { OPP_RUN_HINT } from "@/modules/opportunity/session";
import type { OppNotification } from "@/modules/opportunity/types";
import { OppGate } from "@/modules/opportunity/ui/OppGate";
import { AppHeader, EmptyState } from "@/ui";
import { cx } from "@/ui/cx";

/** OPP-17 Deadline Reminders / Opportunity notifications (FR-OPP-005). */
export default function OppNotificationsPage() {
  return (
    <>
      <AppHeader title="Thông báo" backHref="/opportunities" />
      <OppGate>{() => <NotificationList />}</OppGate>
    </>
  );
}

/** Deep links from the Opportunity backend are its own paths; map them into this app. */
function inAppLink(deepLink: string | null): string | null {
  if (!deepLink) return null;
  const m = deepLink.match(/\/opportunities\/([A-Za-z0-9_-]+)/);
  if (m) return `/opportunities/${m[1]}`;
  if (deepLink.includes("/applications")) return "/opportunities/applications";
  return null;
}

function NotificationList() {
  const { data, error, loading, reload } = useHub<{ items: OppNotification[] }>("opp", "/me/notifications");
  if (loading && !data) return <ListSkeleton />;
  if (error) return <HubErrorState error={error} onRetry={reload} hubName="Cơ hội" runHint={OPP_RUN_HINT} />;
  const items = data?.items ?? [];
  if (items.length === 0) {
    return <EmptyState icon={BellRing} title="Chưa có thông báo" description="Lưu cơ hội để được nhắc trước hạn nộp hồ sơ." />;
  }
  return (
    <ul className="mx-4 mt-2 divide-y divide-line overflow-hidden rounded-[var(--radius-card)] border border-line bg-surface">
      {items.map((n) => {
        const href = inAppLink(n.deepLink);
        const body = (
          <>
            <span className={cx("mt-1.5 size-2.5 shrink-0 rounded-full", n.readAt ? "bg-transparent" : "bg-primary")} aria-label={n.readAt ? undefined : "Chưa đọc"} />
            <span className="min-w-0 flex-1">
              <span className="block text-[15px] font-semibold text-ink">{n.title}</span>
              <span className="mt-0.5 block text-[14px] text-ink-2">{n.body}</span>
              <span className="mt-1 block text-[12px] text-muted">{new Date(n.createdAt).toLocaleString("vi-VN")}</span>
            </span>
          </>
        );
        return (
          <li key={n.id}>
            {href ? (
              <Link href={href} className="pressable flex gap-3 px-4 py-3 active:bg-surface-2">
                {body}
              </Link>
            ) : (
              <div className="flex gap-3 px-4 py-3">{body}</div>
            )}
          </li>
        );
      })}
    </ul>
  );
}

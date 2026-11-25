"use client";

import { BellRing, CheckCheck } from "lucide-react";
import { useState } from "react";
import { useClub } from "@/modules/club/session";
import { fmtDateTime } from "@/modules/club/types";
import { AppHeader, EmptyState, HeaderIconButton } from "@/ui";
import { cx } from "@/ui/cx";

/** COM-21 Community Notifications (club inbox, FR-CORE-006 read/unread). */
export default function ClubNotificationsPage() {
  const { home, act } = useClub();
  const [busy, setBusy] = useState(false);
  const items = home.notifications;
  const unread = items.filter((n) => n.unread).length;

  return (
    <>
      <AppHeader
        back
        backFallback="/club/more"
        title="Thông báo CLB"
        actions={
          unread > 0 && (
            <HeaderIconButton
              label="Đánh dấu tất cả đã đọc"
              onClick={async () => {
                setBusy(true);
                await act("mark_all_notifications_read").catch(() => undefined);
                setBusy(false);
              }}
            >
              <CheckCheck size={22} className={busy ? "opacity-40" : ""} />
            </HeaderIconButton>
          )
        }
      />
      {items.length === 0 ? (
        <EmptyState icon={BellRing} title="Chưa có thông báo" />
      ) : (
        <ul className="mx-4 divide-y divide-line overflow-hidden rounded-[var(--radius-card)] border border-line bg-surface">
          {items.map((n) => (
            <li key={n.id}>
              <button
                type="button"
                onClick={() => n.unread && act("mark_notification_read", { notificationId: n.id }).catch(() => undefined)}
                className="flex w-full gap-3 px-4 py-3 text-left active:bg-surface-2"
              >
                <span className={cx("mt-1.5 size-2.5 shrink-0 rounded-full", n.unread ? "bg-primary" : "bg-transparent")} />
                <span className="min-w-0 flex-1">
                  <span className={cx("block text-[15px] text-ink", n.unread && "font-semibold")}>{n.title}</span>
                  {n.body && <span className="mt-0.5 block text-[14px] text-ink-2">{n.body}</span>}
                  <span className="mt-1 block text-[12px] text-muted">{fmtDateTime(n.createdAt)}</span>
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </>
  );
}

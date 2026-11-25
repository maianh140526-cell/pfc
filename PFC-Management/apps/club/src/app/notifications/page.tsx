"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { AppHeader } from "@/components/MobileChrome";
import { useClubData } from "@/components/useClubData";
import {
  notifyIcon,
  resolveNotifyScope,
  type NotifyScope,
} from "@/domain/notify-scope";

const FILTERS: { id: NotifyScope | "all"; label: string }[] = [
  { id: "all", label: "Tất cả" },
  { id: "club", label: "🌐 Toàn CLB" },
  { id: "team", label: "👥 Nội bộ Ban" },
  { id: "personal", label: "📌 Cá nhân" },
];

function relativeTime(d?: string | Date | null) {
  if (!d) return "";
  const t = new Date(d).getTime();
  if (!Number.isFinite(t)) return "";
  const mins = Math.max(0, Math.round((Date.now() - t) / 60_000));
  if (mins < 1) return "Vừa xong";
  if (mins < 60) return `${mins} phút trước`;
  const hours = Math.round(mins / 60);
  if (hours < 24) return `${hours} giờ trước`;
  const days = Math.round(hours / 24);
  return `${days} ngày trước`;
}

type Row = {
  id: string;
  type: string;
  title: string;
  body: string;
  readAt: string | Date | null;
  createdAt: string | Date;
  scope?: NotifyScope;
  icon?: string;
  unread?: boolean;
  payloadJson?: string | null;
};

export default function NotificationsPage() {
  const { data, error, post, reload, loading } = useClubData();
  const [filter, setFilter] = useState<(typeof FILTERS)[number]["id"]>("all");
  const [busy, setBusy] = useState(false);

  const rows = useMemo(() => {
    const list = (data?.notifications ?? []) as Row[];
    return list.map((n) => {
      let payload: Record<string, unknown> | null = null;
      if (n.payloadJson) {
        try {
          payload = JSON.parse(n.payloadJson) as Record<string, unknown>;
        } catch {
          payload = null;
        }
      }
      const scope = n.scope ?? resolveNotifyScope(n.type, payload);
      return {
        ...n,
        scope,
        icon: n.icon ?? notifyIcon(n.type),
        unread: n.unread ?? !n.readAt,
      };
    });
  }, [data?.notifications]);

  const visible = rows.filter((n) =>
    filter === "all" ? true : n.scope === filter,
  );
  const unreadCount = rows.filter((n) => n.unread).length;

  async function markAll() {
    setBusy(true);
    try {
      await post({ action: "mark_all_notifications_read" });
    } finally {
      setBusy(false);
    }
  }

  async function markOne(id: string) {
    setBusy(true);
    try {
      await post({ action: "mark_notification_read", notificationId: id });
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <AppHeader title="Thông báo" />
      {error && (
        <div className="error-banner">
          {error}{" "}
          <Link href="/login" className="btn-ghost">
            Đăng nhập
          </Link>
        </div>
      )}

      <div className="notif-toolbar">
        <p className="notif-count">
          {unreadCount > 0 ? `${unreadCount} chưa đọc` : "Đã xem hết"}
        </p>
        <button
          type="button"
          className="notif-mark-all"
          disabled={busy || unreadCount === 0}
          onClick={() => void markAll()}
        >
          Đánh dấu tất cả đã đọc
        </button>
      </div>

      <div className="notif-filters" role="tablist">
        {FILTERS.map((f) => (
          <button
            key={f.id}
            type="button"
            role="tab"
            aria-selected={filter === f.id}
            className={`notif-filter${filter === f.id ? " active" : ""}`}
            onClick={() => setFilter(f.id)}
          >
            {f.label}
          </button>
        ))}
      </div>

      <section className="section notif-list">
        {loading && <p className="muted">Đang tải…</p>}
        {!loading &&
          visible.map((n) => (
            <button
              type="button"
              key={n.id}
              className={`notif-card${n.unread ? " unread" : ""}`}
              onClick={() => {
                if (n.unread) void markOne(n.id);
              }}
            >
              <span className="notif-ico" aria-hidden>
                {n.icon}
              </span>
              <div className="notif-body">
                <div className="notif-top">
                  <strong>{n.title}</strong>
                  {n.unread && (
                    <span className="notif-dot" title="Chưa đọc" aria-label="Chưa đọc">
                      🔴
                    </span>
                  )}
                </div>
                <p>{n.body || "—"}</p>
                <span className="notif-time">{relativeTime(n.createdAt)}</span>
              </div>
            </button>
          ))}
        {!loading && !visible.length && (
          <p className="muted" style={{ padding: 12 }}>
            Chưa có thông báo trong mục này.
          </p>
        )}
        <button type="button" className="btn-ghost" onClick={() => void reload()}>
          Làm mới
        </button>
      </section>
    </>
  );
}

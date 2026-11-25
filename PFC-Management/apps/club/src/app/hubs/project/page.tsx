"use client";

import Link from "next/link";
import { AppHeader } from "@/components/MobileChrome";
import { useClubData } from "@/components/useClubData";

/** BUILD zone — surfaces Club Tasks until dedicated Project module exists. */
export default function ProjectHubPage() {
  const { data, error, loading } = useClubData();
  const kanban = data?.kanban ?? {};
  const cols = ["backlog", "todo", "in_progress", "review", "done"] as const;
  const all = cols.flatMap((c) => kanban[c] ?? []);

  return (
    <>
      <AppHeader title="03 · Project" />
      <div className="hub-zone-banner tone-emerald">
        <Link href="/lobby" className="hub-back-inline">
          ← Phòng khách
        </Link>
        <h2>🛠️ Project · BUILD</h2>
        <p>
          Dự án thực chiến từ Task Management Club (module Project riêng chưa
          có — đang dùng Kanban / sub-tasks đã build).
        </p>
        <Link href="/tasks" className="hub-zone-cta">
          Mở Kanban đầy đủ →
        </Link>
      </div>

      {error && (
        <div className="error-banner">
          {error}{" "}
          <Link href="/login">Đăng nhập</Link>
        </div>
      )}

      <section className="section">
        <div className="section-title">
          <h3>Dự án / task chính</h3>
          <span className="muted">{all.length}</span>
        </div>
        {loading && <p className="muted">Đang tải…</p>}
        {all.slice(0, 12).map((t) => (
          <Link key={t.id} href="/tasks" className="hub-zone-card">
            <strong>{t.title}</strong>
            <span className="muted">
              {t.status} · {t.teamName ?? "Chưa gắn ban"} ·{" "}
              {t.checklistDone ?? 0}/{t.checklistTotal ?? 0} sub-tasks
            </span>
          </Link>
        ))}
        {!loading && !all.length && (
          <p className="muted">Chưa có task — tạo ở /tasks.</p>
        )}
      </section>
    </>
  );
}

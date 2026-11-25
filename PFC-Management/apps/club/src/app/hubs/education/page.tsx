"use client";

import Link from "next/link";
import { AppHeader } from "@/components/MobileChrome";
import { useClubData } from "@/components/useClubData";

/** LEARN zone — surfaces Club Activities until dedicated Education module exists. */
export default function EducationHubPage() {
  const { data, error, loading } = useClubData();
  const activities = data?.activities ?? [];

  return (
    <>
      <AppHeader title="02 · Education" />
      <div className="hub-zone-banner tone-sky">
        <Link href="/lobby" className="hub-back-inline">
          ← Phòng khách
        </Link>
        <h2>📚 Education · LEARN</h2>
        <p>
          Workshop & hoạt động học từ Club Activities (module Education riêng
          chưa có folder — đang dùng surface Club đã build).
        </p>
        <Link href="/events#hoat-dong" className="hub-zone-cta">
          Mở đầy đủ Sự kiện / Hoạt động →
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
          <h3>Khóa học / workshop</h3>
          <span className="muted">{activities.length}</span>
        </div>
        {loading && <p className="muted">Đang tải…</p>}
        {activities.map((a) => (
          <Link
            key={a.id}
            href={`/events/${a.id}`}
            className="hub-zone-card"
          >
            <strong>{a.title}</strong>
            <span className="muted">
              {a.status} · {a.mode ?? "offline"}
              {a.location ? ` · ${a.location}` : ""}
            </span>
          </Link>
        ))}
        {!loading && !activities.length && (
          <p className="muted">Chưa có hoạt động — tạo ở /events/create.</p>
        )}
      </section>
    </>
  );
}

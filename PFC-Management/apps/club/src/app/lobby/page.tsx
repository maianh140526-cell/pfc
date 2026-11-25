"use client";

import Link from "next/link";
import { AppHeader } from "@/components/MobileChrome";
import { useClubData } from "@/components/useClubData";
import { HUB_BRANCHES, hubLobbyHref } from "@/domain/hub-branches";

const CAROUSEL = [
  {
    title: "Chào mừng đến Phòng khách PFC",
    body: "Sáu nhánh chiến lược — bắt đầu từ Club Management.",
    cta: { href: "/manage", label: "Vào quản lý" },
  },
  {
    title: "Công việc tuần này",
    body: "Kanban & sub-task theo ban — cập nhật tiến độ mỗi ngày.",
    cta: { href: "/tasks", label: "Xem công việc" },
  },
  {
    title: "Thông báo nội bộ",
    body: "Tin toàn CLB, tin ban, và việc được giao cho bạn.",
    cta: { href: "/notifications", label: "Mở thông báo" },
  },
] as const;

export default function LobbyPage() {
  const { data, error, loading } = useClubData();
  const unread =
    data?.notifications?.filter((n) => !n.readAt).length ?? 0;

  return (
    <>
      <AppHeader showSearch />
      {error && (
        <div className="error-banner">
          {error}{" "}
          <Link href="/login" className="btn-ghost">
            Đăng nhập
          </Link>
        </div>
      )}

      <section className="lobby-hero">
        <p className="lobby-kicker">PFC Digital Hub</p>
        <h2>
          Phòng khách
          <br />
          Personal Finance Club
        </h2>
        <p>
          {data?.club.name ?? "PFC Investors"} ·{" "}
          {data?.report?.members.active ?? "—"} thành viên
          {unread > 0 ? ` · ${unread} thông báo mới` : ""}
        </p>
      </section>

      <section className="lobby-carousel" aria-label="Tin nổi bật">
        <div className="lobby-carousel-track">
          {CAROUSEL.map((slide, i) => (
            <article key={slide.title} className="lobby-slide">
              <span className="lobby-slide-idx">0{i + 1}</span>
              <h3>{slide.title}</h3>
              <p>{slide.body}</p>
              <Link href={slide.cta.href} className="lobby-slide-cta">
                {slide.cta.label} →
              </Link>
            </article>
          ))}
        </div>
      </section>

      <section className="section lobby-hubs">
        <div className="section-title">
          <h3>6 nhánh chiến lược</h3>
          <span className="muted" style={{ fontSize: 12 }}>
            3 đã có · 3 sắp có
          </span>
        </div>
        <div className="lobby-hub-grid">
          {HUB_BRANCHES.map((b) => (
            <Link
              key={b.id}
              href={hubLobbyHref(b)}
              className={`lobby-hub-card tone-${b.tone}${b.ready ? "" : " soon"}`}
            >
              <span className="lobby-hub-id">{b.id}</span>
              <span
                className={`lobby-hub-badge${b.ready ? " ready" : ""}`}
              >
                {b.ready ? "Đã có" : "Sắp có"}
              </span>
              <span className="lobby-hub-ico" aria-hidden>
                {b.icon}
              </span>
              <strong>{b.title}</strong>
              <span>{b.subtitle}</span>
            </Link>
          ))}
        </div>
      </section>

      <section className="section">
        <div className="section-title">
          <h3>PFC Honors</h3>
          <Link href="/members" className="btn-ghost">
            Bảng thành viên
          </Link>
        </div>
        <div className="lobby-honors">
          <div className="lobby-honor-card">
            <span aria-hidden>🏆</span>
            <div>
              <strong>Star Contributor</strong>
              <p className="muted">
                {loading
                  ? "…"
                  : `${data?.report?.tasks.doneThisMonth ?? 0} task hoàn thành tháng này`}
              </p>
            </div>
          </div>
          <div className="lobby-honor-card">
            <span aria-hidden>🌟</span>
            <div>
              <strong>Active Club</strong>
              <p className="muted">
                {data?.report?.activities ?? 0} hoạt động ·{" "}
                {data?.report?.linkedEvents ?? 0} sự kiện gắn
              </p>
            </div>
          </div>
          <div className="lobby-honor-card">
            <span aria-hidden>💜</span>
            <div>
              <strong>Community Pulse</strong>
              <p className="muted">
                {data?.club.visibility === "private" ? "Riêng tư" : "Công khai"}{" "}
                · {data?.club.status === "active" ? "Đang hoạt động" : data?.club.status}
              </p>
            </div>
          </div>
        </div>
      </section>

      <section className="section">
        <div className="section-title">
          <h3>Lối tắt Club ops</h3>
        </div>
        <div className="quick-grid">
          {[
            { href: "/manage", icon: "⚙️", label: "Quản lý" },
            { href: "/members", icon: "👥", label: "Thành viên" },
            { href: "/events", icon: "📅", label: "Sự kiện" },
            { href: "/join", icon: "➕", label: "Mời join" },
          ].map((q) => (
            <Link key={q.href} href={q.href} className="quick-item">
              <div className="quick-icon">{q.icon}</div>
              {q.label}
            </Link>
          ))}
        </div>
      </section>
    </>
  );
}

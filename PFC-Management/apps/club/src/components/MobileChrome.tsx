"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";

const ITEMS = [
  { href: "/lobby", label: "Phòng khách", icon: "🏠" },
  { href: "/notifications", label: "Thông báo", icon: "📢" },
  { href: "/tasks", label: "Công việc", icon: "📋" },
  { href: "/settings", label: "Cài đặt", icon: "⚙️" },
] as const;

export function PfcLogo({
  size = 36,
  className = "logo-mark",
}: {
  size?: number;
  className?: string;
}) {
  return (
    <span className={className} style={{ width: size, height: size }}>
      <Image
        src="/pfc-logo.svg"
        alt="Personal Finance Club"
        width={size}
        height={size}
        priority
      />
    </span>
  );
}

export function BottomNav() {
  const pathname = usePathname();
  if (pathname === "/login" || pathname.startsWith("/login")) return null;

  return (
    <nav className="bottom-nav" aria-label="Điều hướng chính">
      {ITEMS.map((item) => {
        const active =
          item.href === "/lobby"
            ? pathname === "/lobby" || pathname === "/"
            : pathname.startsWith(item.href);
        return (
          <Link
            key={item.href}
            href={item.href}
            className={`nav-item${active ? " active" : ""}`}
          >
            <span className="nav-ico">{item.icon}</span>
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}

export function AppHeader({
  title,
  showSearch = false,
}: {
  title?: string;
  showSearch?: boolean;
}) {
  return (
    <div className="app-header">
      <Link href="/lobby" aria-label="Về Phòng khách">
        <PfcLogo />
      </Link>
      {showSearch ? (
        <Link
          href="/members"
          className="search-pill"
          aria-label="Tìm thành viên"
        >
          🔍 Tìm kiếm trong CLB...
        </Link>
      ) : (
        <h1>{title}</h1>
      )}
      <Link
        href="/notifications"
        className="icon-btn"
        aria-label="Thông báo"
      >
        🔔
      </Link>
    </div>
  );
}

"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { BookOpen, House, Menu, Users, Wallet, type LucideIcon } from "lucide-react";
import { cx } from "./cx";
import { isTabActive } from "./tab-match";

/** DEC-M5 (provisional): fixed 5 tabs taken from mockup 8 / 12. */
export const TABS: ReadonlyArray<{ href: string; label: string; icon: LucideIcon }> = [
  { href: "/home", label: "Trang chủ", icon: House },
  { href: "/finance", label: "Tài chính", icon: Wallet },
  { href: "/learn", label: "Học tập", icon: BookOpen },
  { href: "/community", label: "Cộng đồng", icon: Users },
  { href: "/more", label: "Thêm", icon: Menu },
];

export function TabBar() {
  const pathname = usePathname();
  return (
    <nav
      aria-label="Điều hướng chính"
      className="fixed-in-canvas bottom-0 z-40 border-t border-line bg-surface/95 pb-[var(--safe-bottom)] backdrop-blur-md"
    >
      <ul className="grid h-[var(--tabbar-h)] grid-cols-5">
        {TABS.map(({ href, label, icon: Icon }) => {
          const active = isTabActive(pathname, href);
          return (
            <li key={href}>
              <Link
                href={href}
                aria-current={active ? "page" : undefined}
                className={cx(
                  "pressable flex h-full flex-col items-center justify-center gap-1 text-[11px] font-semibold",
                  active ? "text-primary" : "text-muted",
                )}
              >
                <span
                  className={cx(
                    "grid h-7 w-12 place-items-center rounded-full transition-colors",
                    active && "bg-primary-soft",
                  )}
                >
                  <Icon size={21} strokeWidth={active ? 2.4 : 2} />
                </span>
                {label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}

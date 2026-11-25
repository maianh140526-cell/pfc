"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { LucideIcon } from "lucide-react";
import { cx } from "./cx";

export type HubTab = {
  href: string;
  label: string;
  icon: LucideIcon;
  /** Extra path prefixes that should light this tab up. */
  match?: readonly string[];
  /** Only exact `href` matches (for the hub root tab). */
  exact?: boolean;
  /** Raised primary circle in the middle (mockup FAB-in-tabbar pattern). */
  primary?: boolean;
};

export function hubTabActive(pathname: string, tab: HubTab): boolean {
  if (tab.primary) return pathname === tab.href;
  const prefixes = [tab.href, ...(tab.match ?? [])];
  return prefixes.some((p) => pathname === p || (!tab.exact && pathname.startsWith(`${p}/`)));
}

/**
 * Each hub's own bottom navigation (its "app inside the app"). The hub root header has a
 * ‹ back to PFC Home, so the global tab bar is not shown inside hubs.
 */
export function HubTabBar({ tabs, label }: { tabs: readonly HubTab[]; label: string }) {
  const pathname = usePathname();
  return (
    <nav
      aria-label={label}
      className="fixed-in-canvas bottom-0 z-40 border-t border-line bg-surface/95 pb-[var(--safe-bottom)] backdrop-blur-md"
    >
      <ul className="grid h-[var(--tabbar-h)]" style={{ gridTemplateColumns: `repeat(${tabs.length}, minmax(0, 1fr))` }}>
        {tabs.map((tab) => {
          const Icon = tab.icon;
          const active = hubTabActive(pathname, tab);
          if (tab.primary) {
            return (
              <li key={tab.href} className="flex items-start justify-center">
                <Link
                  href={tab.href}
                  aria-label={tab.label}
                  className="pressable -mt-5 grid size-14 place-items-center rounded-full bg-primary text-on-primary shadow-sheet ring-4 ring-bg"
                >
                  <Icon size={26} strokeWidth={2.4} />
                </Link>
              </li>
            );
          }
          return (
            <li key={tab.href}>
              <Link
                href={tab.href}
                aria-current={active ? "page" : undefined}
                className={cx(
                  "pressable flex h-full flex-col items-center justify-center gap-1 text-[11px] font-semibold",
                  active ? "text-primary" : "text-muted",
                )}
              >
                <span className={cx("grid h-7 w-12 place-items-center rounded-full", active && "bg-primary-soft")}>
                  <Icon size={21} strokeWidth={active ? 2.4 : 2} />
                </span>
                <span className="max-w-full truncate px-1">{tab.label}</span>
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}

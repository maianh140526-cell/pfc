"use client";

import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ChevronLeft } from "lucide-react";
import type { ReactNode } from "react";

/**
 * Two header shapes from the mockups:
 *  - brand: PFC mark + optional big title (tab roots, mockup 8/18/37)
 *  - back:  ‹ + title (child screens, mockup 13/22/23). In iOS standalone mode there is no
 *           browser back button, so every child screen must render this.
 */
export function AppHeader({
  title,
  subtitle,
  back,
  backFallback = "/home",
  backHref,
  actions,
}: {
  title?: string;
  subtitle?: string;
  back?: boolean;
  backFallback?: string;
  /** Fixed destination instead of history back (hub roots → /home). Implies `back`. */
  backHref?: string;
  actions?: ReactNode;
}) {
  if (backHref) back = true;
  const router = useRouter();

  function goBack() {
    // Opened directly (deep link / home-screen shortcut): no in-app history to return to.
    if (window.history.length > 1) router.back();
    else router.replace(backFallback);
  }

  return (
    <header className="sticky top-0 z-30 bg-bg/85 pt-[var(--safe-top)] backdrop-blur-md">
      <div className="flex h-[var(--header-h)] items-center gap-2 px-2">
        {backHref ? (
          <Link
            href={backHref}
            aria-label="Quay lại"
            className="pressable grid size-11 place-items-center rounded-full text-ink active:bg-surface-2"
          >
            <ChevronLeft size={26} strokeWidth={2.2} />
          </Link>
        ) : back ? (
          <button
            type="button"
            onClick={goBack}
            aria-label="Quay lại"
            className="pressable grid size-11 place-items-center rounded-full text-ink active:bg-surface-2"
          >
            <ChevronLeft size={26} strokeWidth={2.2} />
          </button>
        ) : (
          <Link href="/home" aria-label="PFC — Trang chủ" className="flex items-center gap-2 pl-2">
            <Image src="/brand/pfc-mark.png" alt="" width={32} height={32} className="rounded-lg" priority />
            <span className="text-lg font-extrabold tracking-tight text-primary">PFC</span>
          </Link>
        )}
        {back && title ? (
          <h1 className="min-w-0 flex-1 truncate text-[18px] font-bold text-ink">{title}</h1>
        ) : (
          <div className="flex-1" />
        )}
        {actions && <div className="flex items-center gap-1 pr-1">{actions}</div>}
      </div>
      {!back && title && (
        <div className="px-4 pb-2">
          <h1 className="text-[26px] leading-tight font-extrabold text-ink">{title}</h1>
          {subtitle && <p className="mt-1 text-sm text-muted">{subtitle}</p>}
        </div>
      )}
    </header>
  );
}

export function HeaderIconButton({
  label,
  href,
  onClick,
  children,
}: {
  label: string;
  href?: string;
  onClick?: () => void;
  children: ReactNode;
}) {
  const cls = "pressable grid size-11 place-items-center rounded-full text-ink active:bg-surface-2";
  if (href)
    return (
      <Link href={href} aria-label={label} className={cls}>
        {children}
      </Link>
    );
  return (
    <button type="button" aria-label={label} onClick={onClick} className={cls}>
      {children}
    </button>
  );
}

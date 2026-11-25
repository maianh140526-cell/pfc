import Link from "next/link";
import { ChevronRight, type LucideIcon } from "lucide-react";
import type { ReactNode } from "react";
import { cx } from "./cx";

export function ListGroup({ children, label }: { children: ReactNode; label?: string }) {
  return (
    <div>
      {label && <p className="mb-2 px-1 text-[13px] font-semibold text-muted uppercase">{label}</p>}
      <ul className="divide-y divide-line overflow-hidden rounded-[var(--radius-card)] border border-line bg-surface">
        {children}
      </ul>
    </div>
  );
}

/** Settings-style row (mockup 12/14/87). Renders a link, a button, or a static row. */
export function ListItem({
  icon: Icon,
  title,
  description,
  trailing,
  href,
  onClick,
  disabled,
}: {
  icon?: LucideIcon;
  title: string;
  description?: string;
  trailing?: ReactNode;
  href?: string;
  onClick?: () => void;
  disabled?: boolean;
}) {
  const interactive = !disabled && Boolean(href || onClick);
  const body = (
    <>
      {Icon && (
        <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-primary-soft text-primary">
          <Icon size={20} />
        </span>
      )}
      <span className="min-w-0 flex-1">
        <span className="block truncate text-[15px] font-semibold text-ink">{title}</span>
        {description && <span className="mt-0.5 block text-[13px] text-muted">{description}</span>}
      </span>
      {trailing}
      {interactive && <ChevronRight size={18} className="shrink-0 text-muted" />}
    </>
  );
  const cls = cx(
    "flex min-h-16 w-full items-center gap-3 px-4 py-3 text-left",
    interactive && "pressable active:bg-surface-2",
    disabled && "opacity-55",
  );

  return (
    <li>
      {href && !disabled ? (
        <Link href={href} className={cls}>
          {body}
        </Link>
      ) : onClick && !disabled ? (
        <button type="button" onClick={onClick} className={cls}>
          {body}
        </button>
      ) : (
        <div className={cls} aria-disabled={disabled || undefined}>
          {body}
        </div>
      )}
    </li>
  );
}

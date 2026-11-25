import Link from "next/link";
import { cx } from "@/ui/cx";

/** Link-based pill filters (mockup 21: Tất cả · Thu nhập · Chi tiêu). Server-rendered, no JS needed. */
export function FilterChips({
  options,
  value,
  hrefFor,
  label,
}: {
  options: ReadonlyArray<{ value: string; label: string }>;
  value: string;
  hrefFor: (v: string) => string;
  label: string;
}) {
  return (
    <nav aria-label={label} className="no-scrollbar -mx-4 flex gap-2 overflow-x-auto px-4">
      {options.map((o) => {
        const active = o.value === value;
        return (
          <Link
            key={o.value}
            href={hrefFor(o.value)}
            scroll={false}
            replace
            aria-current={active ? "true" : undefined}
            className={cx(
              "pressable shrink-0 rounded-full px-4 py-2 text-[14px] font-semibold whitespace-nowrap",
              active ? "bg-primary text-on-primary" : "border border-line bg-surface text-ink-2",
            )}
          >
            {o.label}
          </Link>
        );
      })}
    </nav>
  );
}

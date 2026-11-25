"use client";

import { cx } from "./cx";

/** Pill segmented control (mockup 21/22: Chi / Thu, Tất cả / Thu / Chi). */
export function SegmentedTabs<T extends string>({
  options,
  value,
  onChange,
  label,
  stretch,
}: {
  options: ReadonlyArray<{ value: T; label: string }>;
  value: T;
  onChange: (v: T) => void;
  label: string;
  stretch?: boolean;
}) {
  return (
    <div
      role="radiogroup"
      aria-label={label}
      className={cx("no-scrollbar flex gap-1 overflow-x-auto rounded-full bg-surface-2 p-1", stretch && "w-full")}
    >
      {options.map((o) => {
        const active = o.value === value;
        return (
          <button
            key={o.value}
            type="button"
            role="radio"
            aria-checked={active}
            onClick={() => onChange(o.value)}
            className={cx(
              "pressable min-h-9 shrink-0 rounded-full px-4 text-[14px] font-semibold whitespace-nowrap transition-colors",
              stretch && "flex-1",
              active ? "bg-primary text-on-primary shadow-card" : "text-ink-2",
            )}
          >
            {o.label}
          </button>
        );
      })}
    </div>
  );
}

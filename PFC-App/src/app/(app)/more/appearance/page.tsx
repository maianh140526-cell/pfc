"use client";

import { Check, Monitor, Moon, Sun, type LucideIcon } from "lucide-react";
import type { ThemePreference } from "@/platform/theme/theme";
import { useTheme } from "@/platform/theme/use-theme";
import { AppHeader } from "@/ui";
import { cx } from "@/ui/cx";

const OPTIONS: ReadonlyArray<{ value: ThemePreference; label: string; hint: string; icon: LucideIcon }> = [
  { value: "light", label: "Sáng", hint: "Luôn dùng giao diện sáng", icon: Sun },
  { value: "dark", label: "Tối", hint: "Luôn dùng giao diện tối", icon: Moon },
  { value: "system", label: "Tự động", hint: "Theo cài đặt của thiết bị", icon: Monitor },
];

/** SYS-14 / mockup 101 "Giao diện". Choice is a per-device preference (localStorage). */
export default function AppearancePage() {
  const { preference, choose } = useTheme();

  return (
    <>
      <AppHeader back backFallback="/more" title="Giao diện" />
      <div role="radiogroup" aria-label="Chế độ giao diện" className="space-y-3 px-4 pt-3">
        {OPTIONS.map(({ value, label, hint, icon: Icon }) => {
          const active = preference === value;
          return (
            <button
              key={value}
              type="button"
              role="radio"
              aria-checked={active}
              onClick={() => choose(value)}
              className={cx(
                "pressable flex w-full items-center gap-3 rounded-[var(--radius-card)] border-2 bg-surface p-4 text-left",
                active ? "border-primary" : "border-line",
              )}
            >
              <span className="grid size-11 place-items-center rounded-xl bg-primary-soft text-primary">
                <Icon size={22} />
              </span>
              <span className="flex-1">
                <span className="block text-[16px] font-bold text-ink">{label}</span>
                <span className="block text-[13px] text-muted">{hint}</span>
              </span>
              <span
                className={cx(
                  "grid size-6 place-items-center rounded-full border-2",
                  active ? "border-primary bg-primary text-on-primary" : "border-line",
                )}
              >
                {active && <Check size={14} strokeWidth={3} />}
              </span>
            </button>
          );
        })}
      </div>
    </>
  );
}

"use client";

import { Check } from "lucide-react";
import { setLocaleAction } from "@/platform/account/actions";
import { Badge } from "@/ui";
import { FormError } from "@/ui/Form";
import { cx } from "@/ui/cx";
import { useAction } from "@/ui/use-action";

/** Only Vietnamese is fully translated; the rest of mockup 270's list is shown as "sắp có" (no fake switch). */
const OPTIONS = [
  { code: "vi", label: "Tiếng Việt", ready: true },
  { code: "en", label: "English", ready: false },
  { code: "ja", label: "日本語 (Japanese)", ready: false },
  { code: "ko", label: "한국어 (Korean)", ready: false },
  { code: "zh", label: "中文 (Chinese)", ready: false },
] as const;

export function LanguagePicker({ value }: { value: string }) {
  const a = useAction();
  return (
    <>
      <ul className="divide-y divide-line overflow-hidden rounded-[var(--radius-card)] border border-line bg-surface" role="radiogroup" aria-label="Ngôn ngữ">
        {OPTIONS.map((o) => {
          const active = value === o.code;
          return (
            <li key={o.code}>
              <button
                type="button"
                role="radio"
                aria-checked={active}
                disabled={!o.ready || a.pending}
                onClick={() => a.run(() => setLocaleAction(o.code))}
                className={cx("flex min-h-14 w-full items-center gap-3 px-4 text-left", !o.ready && "opacity-60")}
              >
                <span className="flex-1 text-[15px] font-semibold text-ink">{o.label}</span>
                {active ? (
                  <span className="grid size-6 place-items-center rounded-full bg-primary text-on-primary">
                    <Check size={14} />
                  </span>
                ) : !o.ready ? (
                  <Badge tone="muted">Sắp có</Badge>
                ) : null}
              </button>
            </li>
          );
        })}
      </ul>
      <FormError message={a.error} />
      <p className="mt-3 text-[12px] text-muted">Ứng dụng hiện có bản tiếng Việt. Các ngôn ngữ khác sẽ được bổ sung.</p>
    </>
  );
}

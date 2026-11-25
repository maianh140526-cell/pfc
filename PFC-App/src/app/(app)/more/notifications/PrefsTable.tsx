"use client";

import { Lock } from "lucide-react";
import { useState } from "react";
import { CATEGORIES, CHANNELS, CHANNEL_LABEL, type Category, type Channel } from "@/platform/notifications/categories";
import { setPrefAction } from "@/platform/notifications/actions";
import { FormError } from "@/ui/Form";
import { cx } from "@/ui/cx";

type Prefs = Record<Category, Record<Channel, boolean>>;

export function PrefsTable({ initial }: { initial: Prefs }) {
  const [prefs, setPrefs] = useState(initial);
  const [error, setError] = useState<string | null>(null);
  async function toggle(c: Category, ch: Channel) {
    const next = !prefs[c][ch];
    setPrefs((p) => ({ ...p, [c]: { ...p[c], [ch]: next } }));
    const r = await setPrefAction(c, ch, next).catch(() => ({ ok: false as const, error: "Không lưu được. Kiểm tra mạng." }));
    if (!r.ok) {
      setError(r.error);
      setPrefs((p) => ({ ...p, [c]: { ...p[c], [ch]: !next } }));
    } else setError(null);
  }
  return (
    <>
      <ul className="space-y-3">
        {(Object.keys(CATEGORIES) as Category[]).map((c) => {
          const meta = CATEGORIES[c];
          return (
            <li key={c} className="rounded-[var(--radius-card)] border border-line bg-surface p-4">
              <p className="text-[15px] font-semibold text-ink">{meta.label}</p>
              <p className="text-[12px] text-muted">{meta.description}</p>
              <div className="mt-3 grid grid-cols-3 gap-2">
                {CHANNELS.map((ch) => {
                  const locked = meta.locked && ch !== "push";
                  const on = prefs[c][ch];
                  return (
                    <button
                      key={ch}
                      type="button"
                      role="switch"
                      aria-checked={on}
                      aria-label={`${meta.label} — ${CHANNEL_LABEL[ch]}`}
                      disabled={locked}
                      onClick={() => toggle(c, ch)}
                      className={cx(
                        "flex min-h-11 items-center justify-center gap-1 rounded-[var(--radius-control)] border px-1 text-[12px] font-semibold",
                        on ? "border-primary bg-primary-soft text-primary" : "border-line text-muted",
                        locked && "opacity-70",
                      )}
                    >
                      {locked && <Lock size={12} />}
                      {CHANNEL_LABEL[ch]}
                    </button>
                  );
                })}
              </div>
            </li>
          );
        })}
      </ul>
      <FormError message={error} />
      <p className="mt-2 text-[12px] text-muted">Thông báo bảo mật luôn gửi trong ứng dụng và qua email để bảo vệ tài khoản.</p>
    </>
  );
}

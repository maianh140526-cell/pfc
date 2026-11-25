"use client";

import { unlinkIdentityAction } from "@/platform/account/actions";
import { Badge } from "@/ui";
import { FormError } from "@/ui/Form";
import { useAction } from "@/ui/use-action";

type Item = { provider: "google" | "facebook"; label: string; enabled: boolean; link: { email: string | null } | null };

export function LinkedList({ items }: { items: Item[] }) {
  const a = useAction();
  return (
    <>
      <ul className="divide-y divide-line overflow-hidden rounded-[var(--radius-card)] border border-line bg-surface">
        {items.map((i) => (
          <li key={i.provider} className="flex min-h-16 items-center gap-3 px-4 py-2">
            <span className="min-w-0 flex-1">
              <span className="block text-[15px] font-semibold text-ink">{i.label}</span>
              <span className="block truncate text-[12px] text-muted">{i.link ? i.link.email ?? "Đã liên kết" : i.enabled ? "Chưa liên kết" : "Chưa bật trên máy chủ"}</span>
            </span>
            {i.link ? (
              <span className="flex items-center gap-2">
                <Badge tone="income">Đã liên kết</Badge>
                <button type="button" className="min-h-11 text-[13px] font-semibold text-expense" disabled={a.pending} onClick={() => a.run(() => unlinkIdentityAction(i.provider))}>
                  Hủy
                </button>
              </span>
            ) : i.enabled ? (
              <a href={`/api/auth/oauth/${i.provider}/start?link=1`} className="rounded-full border border-primary px-4 py-2 text-[13px] font-semibold text-primary">
                Liên kết
              </a>
            ) : (
              <Badge tone="muted">Chưa bật</Badge>
            )}
          </li>
        ))}
      </ul>
      <FormError message={a.error} />
    </>
  );
}

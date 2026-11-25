"use client";

import { Laptop, LogOut, Smartphone, Tablet } from "lucide-react";
import { useState } from "react";
import type { DeviceSession } from "@/platform/auth/session";
import { revokeOtherSessionsAction, revokeSessionAction } from "@/platform/account/actions";
import { Badge, Button } from "@/ui";
import { ConfirmSheet } from "@/ui/ConfirmSheet";
import { FormError } from "@/ui/Form";
import { useAction } from "@/ui/use-action";

const icon = (d: string) => (/iPhone|Android/.test(d) ? Smartphone : /iPad/.test(d) ? Tablet : Laptop);
const when = (iso: string) => new Date(iso).toLocaleString("vi-VN", { hour: "2-digit", minute: "2-digit", day: "2-digit", month: "2-digit", year: "numeric" });

export function DeviceList({ sessions }: { sessions: DeviceSession[] }) {
  const a = useAction();
  const [all, setAll] = useState(false);
  const others = sessions.filter((s) => !s.current).length;
  return (
    <>
      <ul className="divide-y divide-line overflow-hidden rounded-[var(--radius-card)] border border-line bg-surface">
        {sessions.map((s) => {
          const Icon = icon(s.device);
          return (
            <li key={s.id} className="flex items-center gap-3 px-4 py-3">
              <Icon size={26} className="shrink-0 text-ink-2" />
              <span className="min-w-0 flex-1">
                <span className="block truncate text-[15px] font-semibold text-ink">{s.device}</span>
                <span className="block text-[12px] text-muted">
                  {s.ipHint ? `IP ${s.ipHint} · ` : ""}Hoạt động {when(s.lastSeenAt)}
                </span>
                {s.current && (
                  <span className="mt-1 inline-block">
                    <Badge tone="income">Thiết bị hiện tại</Badge>
                  </span>
                )}
              </span>
              {!s.current && (
                <button type="button" aria-label={`Đăng xuất ${s.device}`} disabled={a.pending} onClick={() => a.run(() => revokeSessionAction(s.id))} className="grid size-11 place-items-center rounded-full text-expense active:bg-surface-2">
                  <LogOut size={18} />
                </button>
              )}
            </li>
          );
        })}
      </ul>
      <FormError message={a.error} />
      {others > 0 && (
        <Button variant="secondary" block className="mt-3 text-expense" onClick={() => setAll(true)}>
          Đăng xuất tất cả thiết bị khác ({others})
        </Button>
      )}
      <ConfirmSheet
        open={all}
        onClose={() => setAll(false)}
        title="Đăng xuất thiết bị khác?"
        message={`${others} thiết bị sẽ phải đăng nhập lại. Thiết bị này vẫn giữ đăng nhập.`}
        confirmLabel="Đăng xuất"
        pending={a.pending}
        error={a.error}
        onConfirm={() => a.run(() => revokeOtherSessionsAction(), () => setAll(false))}
      />
    </>
  );
}

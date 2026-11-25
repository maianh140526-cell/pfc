"use client";

import { CloudOff, LogIn, RefreshCw, ShieldAlert } from "lucide-react";
import { Button, EmptyState, Skeleton } from "@/ui";
import type { HubError } from "./client";

export function ListSkeleton({ rows = 4 }: { rows?: number }) {
  return (
    <div className="space-y-3 px-4 pt-3" aria-busy="true" aria-label="Đang tải">
      {Array.from({ length: rows }, (_, i) => (
        <Skeleton key={i} className="h-24 rounded-[var(--radius-card)]" />
      ))}
    </div>
  );
}

/** Error states for hub data: offline backend, no permission, generic. Login is handled by HubLogin. */
export function HubErrorState({ error, onRetry, hubName, runHint }: { error: HubError; onRetry: () => void; hubName: string; runHint?: string }) {
  if (error.offline) {
    return (
      <EmptyState
        icon={CloudOff}
        title={`Chưa kết nối được ${hubName}`}
        description={`Máy chủ ${hubName} hiện không phản hồi.${runHint ? ` ${runHint}` : ""}`}
        action={
          <Button variant="secondary" block onClick={onRetry}>
            <RefreshCw size={18} /> Thử lại
          </Button>
        }
      />
    );
  }
  if (error.status === 403) {
    return <EmptyState icon={ShieldAlert} title="Không có quyền truy cập" description={error.message} />;
  }
  return (
    <EmptyState
      icon={CloudOff}
      title="Không tải được dữ liệu"
      description={error.message}
      action={
        <Button variant="secondary" block onClick={onRetry}>
          <RefreshCw size={18} /> Thử lại
        </Button>
      }
    />
  );
}

/** One account (ADR-011): hubs use the PFC session; signed-out users are sent to PFC login. */
export function PfcLoginPrompt({ hubName }: { hubName: string }) {
  const next = typeof window !== "undefined" ? window.location.pathname + window.location.search : "/home";
  return (
    <div className="flex flex-col items-center px-6 pt-8 text-center">
      <span className="mb-3 grid size-16 place-items-center rounded-full bg-primary-soft text-primary">
        <LogIn size={28} />
      </span>
      <h2 className="text-[19px] font-bold text-ink">Đăng nhập để dùng {hubName}</h2>
      <p className="mt-1 max-w-[300px] text-[14px] text-muted">Một tài khoản PFC dùng được cho tất cả các nhánh.</p>
      <div className="mt-6 grid w-full max-w-[300px] gap-3">
        <a href={`/login?next=${encodeURIComponent(next)}`} className="pressable flex min-h-12 items-center justify-center rounded-[var(--radius-control)] bg-primary text-[15px] font-semibold text-on-primary">
          Đăng nhập
        </a>
        <a href={`/register?next=${encodeURIComponent(next)}`} className="pressable flex min-h-12 items-center justify-center rounded-[var(--radius-control)] border border-primary text-[15px] font-semibold text-primary">
          Tạo tài khoản PFC
        </a>
      </div>
    </div>
  );
}

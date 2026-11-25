"use client";

import Link from "next/link";
import { Send } from "lucide-react";
import { useState } from "react";
import { hubFetch, useHub } from "@/platform/hub-proxy/client";
import { HubErrorState, ListSkeleton } from "@/platform/hub-proxy/HubStates";
import { OPP_RUN_HINT } from "@/modules/opportunity/session";
import { APP_STATUS, TYPE_LABEL, formatDate, type Application, type AppStatus } from "@/modules/opportunity/types";
import { OppGate } from "@/modules/opportunity/ui/OppGate";
import { AppHeader, Badge, Button, ButtonLink, Card, EmptyState } from "@/ui";
import { cx } from "@/ui/cx";

/** OPP-15 My Applications · OPP-16 Application Status (history timeline). */
export default function ApplicationsPage() {
  return (
    <>
      <AppHeader title="Hồ sơ ứng tuyển" backHref="/opportunities" />
      <OppGate>{() => <ApplicationList />}</OppGate>
    </>
  );
}

function ApplicationList() {
  const { data, error, loading, reload } = useHub<{ items: Application[] }>("opp", "/me/applications");
  const [open, setOpen] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);

  if (loading && !data) return <ListSkeleton />;
  if (error) return <HubErrorState error={error} onRetry={reload} hubName="Cơ hội" runHint={OPP_RUN_HINT} />;
  const items = data?.items ?? [];
  if (items.length === 0) {
    return (
      <EmptyState
        icon={Send}
        title="Chưa có hồ sơ nào"
        description="Các cơ hội bạn ứng tuyển sẽ hiện ở đây cùng trạng thái xử lý."
        action={
          <ButtonLink href="/opportunities" block>
            Tìm cơ hội
          </ButtonLink>
        }
      />
    );
  }

  async function confirm(id: string) {
    setBusy(id);
    setErr(null);
    try {
      await hubFetch("opp", `/me/applications/${id}/confirm-external`, { method: "POST" });
      await reload();
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Thất bại.");
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="space-y-3 px-4 pt-2">
      {err && <p className="text-[14px] text-expense">{err}</p>}
      {items.map((a) => {
        const s = APP_STATUS[a.status];
        const expanded = open === a.id;
        return (
          <Card key={a.id} className="p-0">
            <button type="button" onClick={() => setOpen(expanded ? null : a.id)} aria-expanded={expanded} className="w-full p-4 text-left">
              <div className="flex items-start justify-between gap-2">
                <span className="min-w-0">
                  <span className="line-clamp-2 block text-[15px] font-bold text-ink">{a.opportunity.title}</span>
                  <span className="block text-[13px] text-muted">
                    {a.opportunity.provider?.displayName} · {TYPE_LABEL[a.opportunity.type]}
                  </span>
                </span>
                <Badge tone={s.tone}>{s.label}</Badge>
              </div>
              <p className="mt-2 text-[12px] text-muted">
                Nộp ngày {formatDate(a.createdAt)} · {a.channel === "INTERNAL" ? "Qua PFC" : "Trang đơn vị"}
              </p>
            </button>
            {a.status === "REDIRECTED" && (
              <div className="px-4 pb-3">
                <Button className="min-h-10 text-[14px]" block disabled={busy === a.id} onClick={() => confirm(a.id)}>
                  {busy === a.id ? "Đang lưu…" : "Tôi đã nộp xong trên trang đơn vị"}
                </Button>
              </div>
            )}
            {expanded && (
              <ol className="border-t border-line px-4 py-3">
                {a.history.map((h, i) => (
                  <li key={h.id} className="relative flex gap-3 pb-3 last:pb-0">
                    <span className={cx("mt-1.5 size-2.5 shrink-0 rounded-full", i === a.history.length - 1 ? "bg-primary" : "bg-line")} />
                    <span>
                      <span className="block text-[14px] font-semibold text-ink">
                        {APP_STATUS[h.toStatus as AppStatus]?.label ?? h.toStatus}
                      </span>
                      <span className="block text-[12px] text-muted">
                        {new Date(h.createdAt).toLocaleString("vi-VN")}
                        {h.note ? ` · ${h.note}` : ""}
                      </span>
                    </span>
                  </li>
                ))}
                <li className="pt-2">
                  <Link href={`/opportunities/${a.opportunity.id}`} className="text-[13px] font-semibold text-primary">
                    Xem tin tuyển dụng
                  </Link>
                </li>
              </ol>
            )}
          </Card>
        );
      })}
    </div>
  );
}

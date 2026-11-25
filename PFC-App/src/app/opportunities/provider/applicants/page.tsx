"use client";

import { Users } from "lucide-react";
import { useState } from "react";
import { hubFetch, useHub } from "@/platform/hub-proxy/client";
import { HubErrorState, ListSkeleton } from "@/platform/hub-proxy/HubStates";
import { OPP_RUN_HINT } from "@/modules/opportunity/session";
import { APP_STATUS, formatDate, type Application, type AppStatus } from "@/modules/opportunity/types";
import { OppGate } from "@/modules/opportunity/ui/OppGate";
import { AppHeader, Badge, Card, EmptyState } from "@/ui";

/** Same transition table as the Opportunity backend (provider/applicants/[id]). Server enforces it. */
const NEXT: Partial<Record<AppStatus, AppStatus[]>> = {
  SUBMITTED: ["UNDER_REVIEW", "ACCEPTED", "REJECTED"],
  REDIRECTED: ["UNDER_REVIEW", "ACCEPTED", "REJECTED", "CLOSED"],
  UNDER_REVIEW: ["ACCEPTED", "REJECTED"],
};

export default function ApplicantsPage() {
  return (
    <>
      <AppHeader back backFallback="/opportunities/provider" title="Ứng viên" />
      <OppGate>{() => <Applicants />}</OppGate>
    </>
  );
}

function Applicants() {
  const { data, error, loading, reload } = useHub<{ items: Application[] }>("opp", "/provider/applicants");
  const [busy, setBusy] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);
  if (loading && !data) return <ListSkeleton />;
  if (error) return <HubErrorState error={error} onRetry={reload} hubName="Cơ hội" runHint={OPP_RUN_HINT} />;
  const items = data?.items ?? [];
  if (items.length === 0) return <EmptyState icon={Users} title="Chưa có ứng viên" description="Ứng viên cho các tin của bạn sẽ hiện ở đây." />;

  async function move(id: string, status: AppStatus) {
    setBusy(id);
    setErr(null);
    try {
      await hubFetch("opp", `/provider/applicants/${id}`, { method: "PATCH", json: { status } });
      await reload();
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Cập nhật thất bại.");
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="space-y-3 px-4 pt-2">
      {err && <p className="text-[14px] text-expense">{err}</p>}
      {items.map((a) => {
        const s = APP_STATUS[a.status];
        return (
          <Card key={a.id}>
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <p className="text-[15px] font-bold text-ink">{a.member?.name}</p>
                <p className="truncate text-[13px] text-muted">{a.opportunity.title}</p>
                <p className="text-[12px] text-muted">
                  {formatDate(a.createdAt)} · {a.channel === "INTERNAL" ? "Nộp trên PFC" : "Trang đơn vị"}
                  {a.attachmentId ? " · có CV" : ""}
                </p>
              </div>
              <Badge tone={s.tone}>{s.label}</Badge>
            </div>
            {a.coverLetter && <p className="mt-2 line-clamp-3 text-[14px] text-ink-2">{a.coverLetter}</p>}
            {NEXT[a.status] && (
              <div className="mt-3 flex flex-wrap gap-2">
                {NEXT[a.status]!.map((to) => (
                  <button
                    key={to}
                    type="button"
                    disabled={busy === a.id}
                    onClick={() => move(a.id, to)}
                    className="pressable rounded-full border border-line px-3 py-1.5 text-[13px] font-semibold text-ink-2 disabled:opacity-50"
                  >
                    → {APP_STATUS[to].label}
                  </button>
                ))}
              </div>
            )}
          </Card>
        );
      })}
    </div>
  );
}

"use client";

import { ClipboardCheck } from "lucide-react";
import { useState } from "react";
import { hubFetch, useHub } from "@/platform/hub-proxy/client";
import { HubErrorState, ListSkeleton } from "@/platform/hub-proxy/HubStates";
import { OPP_RUN_HINT } from "@/modules/opportunity/session";
import { TIER_LABEL, TYPE_LABEL, formatDate, type Opportunity } from "@/modules/opportunity/types";
import { OppGate } from "@/modules/opportunity/ui/OppGate";
import { AppHeader, BottomSheet, Button, Card, EmptyState } from "@/ui";
import { FormError, TextArea } from "@/ui/Form";

/** OPP-A04 Verification Queue · OPP-A05 Review · OPP-A06 Decision (reviewer). */
export default function ReviewPage() {
  return (
    <>
      <AppHeader back backFallback="/opportunities/account" title="Hàng chờ xác minh" />
      <OppGate>{() => <Queue />}</OppGate>
    </>
  );
}

function Queue() {
  const { data, error, loading, reload } = useHub<{ items: Opportunity[]; postReview?: Opportunity[] }>("opp", "/reviewer/queue");
  const [open, setOpen] = useState<Opportunity | null>(null);
  const [reason, setReason] = useState("");
  const [state, setState] = useState<{ pending?: boolean; error?: string }>({});
  if (loading && !data) return <ListSkeleton />;
  if (error) return <HubErrorState error={error} onRetry={reload} hubName="Cơ hội" runHint={OPP_RUN_HINT} />;
  const items = data?.items ?? [];
  const post = data?.postReview ?? [];
  if (items.length === 0 && post.length === 0) return <EmptyState icon={ClipboardCheck} title="Không có tin chờ duyệt" description="Tin mới gửi xác minh sẽ xuất hiện ở đây." />;
  const live = open?.status === "VERIFIED";

  async function decide(decision: "VERIFIED" | "REJECTED") {
    if (!open) return;
    if (decision === "REJECTED" && !reason.trim()) return setState({ error: "Nhập lý do từ chối để đơn vị biết cần sửa gì." });
    setState({ pending: true });
    try {
      await hubFetch("opp", `/reviewer/queue/${open.id}`, { method: "POST", json: { decision, reason: reason.trim() || undefined } });
      setOpen(null);
      setReason("");
      setState({});
      await reload();
    } catch (e) {
      setState({ error: e instanceof Error ? e.message : "Thất bại." });
    }
  }

  return (
    <div className="space-y-3 px-4 pt-2">
      {items.length > 0 && <p className="text-[13px] font-semibold text-muted uppercase">Chờ duyệt ({items.length})</p>}
      {items.map((o) => (
        <button key={o.id} type="button" className="pressable block w-full text-left" onClick={() => setOpen(o)}>
          <Card>
            <p className="text-[15px] font-bold text-ink">{o.title}</p>
            <p className="text-[13px] text-muted">
              {o.provider?.displayName} · {o.provider ? (TIER_LABEL[o.provider.verificationTier] ?? "Chưa xác minh") : ""}
            </p>
            <p className="mt-1 text-[12px] text-muted">
              {TYPE_LABEL[o.type]} · gửi {formatDate(o.updatedAt)}
            </p>
          </Card>
        </button>
      ))}
      {post.length > 0 && (
        <>
          <p className="pt-2 text-[13px] font-semibold text-muted uppercase">Hậu kiểm: Trusted Partner đã đăng ({post.length})</p>
          {post.map((o) => (
            <button key={o.id} type="button" className="pressable block w-full text-left" onClick={() => setOpen(o)}>
              <Card>
                <p className="text-[15px] font-bold text-ink">{o.title}</p>
                <p className="text-[13px] text-muted">
                  {o.provider?.displayName} · đang hiển thị
                </p>
                <p className="mt-1 text-[12px] text-muted">
                  {TYPE_LABEL[o.type]} · {o.deadlineAt ? `hạn ${formatDate(o.deadlineAt)}` : "không có hạn"}
                </p>
              </Card>
            </button>
          ))}
        </>
      )}
      <BottomSheet
        open={open !== null}
        onClose={() => setOpen(null)}
        title={live ? "Hậu kiểm tin đã đăng" : "Xem xét tin đăng"}
        footer={
          live ? (
            <Button variant="danger" block disabled={state.pending} onClick={() => decide("REJECTED")}>
              Gỡ tin
            </Button>
          ) : (
            <div className="grid grid-cols-2 gap-3">
              <Button variant="danger" disabled={state.pending} onClick={() => decide("REJECTED")}>
                Từ chối
              </Button>
              <Button disabled={state.pending} onClick={() => decide("VERIFIED")}>
                Xác minh
              </Button>
            </div>
          )
        }
      >
        {open && (
          <div className="space-y-3">
            <p className="text-[17px] font-bold text-ink">{open.title}</p>
            <p className="text-[14px] whitespace-pre-line text-ink-2">{open.description}</p>
            {open.externalUrl && (
              <p className="text-[13px] break-all text-muted">
                Liên kết: <span className="text-ink">{open.externalUrl}</span>
              </p>
            )}
            <TextArea label={live ? "Lý do gỡ tin (bắt buộc)" : "Lý do (bắt buộc khi từ chối)"} value={reason} onChange={(e) => setReason(e.target.value)} maxLength={500} />
            <FormError message={state.error} />
          </div>
        )}
      </BottomSheet>
    </div>
  );
}

"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { CheckCircle2, ExternalLink, FileUp } from "lucide-react";
import { useMemo, useRef, useState } from "react";
import { hubFetch, useHub } from "@/platform/hub-proxy/client";
import { HubErrorState, ListSkeleton } from "@/platform/hub-proxy/HubStates";
import { OPP_RUN_HINT } from "@/modules/opportunity/session";
import { newIdempotencyKey, type Opportunity } from "@/modules/opportunity/types";
import { OppGate } from "@/modules/opportunity/ui/OppGate";
import { AppHeader, Button, ButtonLink, Card, SegmentedTabs } from "@/ui";
import { FormError, TextArea } from "@/ui/Form";

const CV_TYPES = ".pdf,.doc,.docx,application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document";

/** OPP-12 Apply · OPP-13 External · OPP-14 Internal (mockup 57). */
export default function ApplyPage() {
  const { id } = useParams<{ id: string }>();
  return (
    <>
      <AppHeader back backFallback={`/opportunities/${id}`} title="Ứng tuyển" />
      <OppGate>{() => <ApplyFlow id={id} />}</OppGate>
    </>
  );
}

function ApplyFlow({ id }: { id: string }) {
  const { data: o, error, loading, reload } = useHub<Opportunity>("opp", `/opportunities/${encodeURIComponent(id)}`);
  const [channel, setChannel] = useState<"INTERNAL" | "EXTERNAL" | null>(null);
  const [cover, setCover] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [state, setState] = useState<{ pending?: boolean; error?: string; done?: "internal" | "external"; appId?: string }>({});
  const fileInput = useRef<HTMLInputElement>(null);
  // One key per page visit: retries / double taps never create duplicate applications (NFR-R-002).
  const idemKey = useMemo(newIdempotencyKey, []);

  if (loading && !o) return <ListSkeleton rows={2} />;
  if (error || !o) return error ? <HubErrorState error={error} onRetry={reload} hubName="Cơ hội" runHint={OPP_RUN_HINT} /> : null;

  const mode = channel ?? (o.applyMode === "EXTERNAL" ? "EXTERNAL" : "INTERNAL");

  async function applyInternal() {
    setState({ pending: true });
    try {
      let attachmentId: string | undefined;
      if (file) {
        const fd = new FormData();
        fd.append("file", file);
        const up = await hubFetch<{ attachmentId: string }>("opp", "/me/cv", { method: "POST", body: fd });
        attachmentId = up.attachmentId;
      }
      const r = await hubFetch<{ applicationId: string }>("opp", `/opportunities/${o!.id}/apply/internal`, {
        method: "POST",
        json: { coverLetter: cover.trim() || undefined, attachmentId, idempotencyKey: idemKey },
      });
      setState({ done: "internal", appId: r.applicationId });
    } catch (e) {
      setState({ error: e instanceof Error ? e.message : "Ứng tuyển thất bại." });
    }
  }

  /** ADR-003: the application is recorded first, then the external page opens. */
  async function applyExternal() {
    setState({ pending: true });
    // Open synchronously (inside the tap) so popup blockers allow it; with the "noopener"
    // feature window.open returns null, so cut the opener link by hand instead.
    const win = window.open("about:blank", "_blank");
    if (win) win.opener = null;
    try {
      const r = await hubFetch<{ applicationId: string; externalUrl: string }>("opp", `/opportunities/${o!.id}/apply/external`, {
        method: "POST",
        headers: { "idempotency-key": idemKey },
      });
      const url = new URL(r.externalUrl);
      if (url.protocol !== "https:") throw new Error("Liên kết ứng tuyển không an toàn.");
      if (win) win.location.href = url.toString();
      else window.location.href = url.toString();
      setState({ done: "external", appId: r.applicationId });
    } catch (e) {
      win?.close();
      setState({ error: e instanceof Error ? e.message : "Không mở được trang ứng tuyển." });
    }
  }

  async function confirmExternal() {
    if (!state.appId) return;
    setState((s) => ({ ...s, pending: true, error: undefined }));
    try {
      await hubFetch("opp", `/me/applications/${state.appId}/confirm-external`, { method: "POST" });
      setState({ done: "internal", appId: state.appId });
    } catch (e) {
      setState((s) => ({ ...s, pending: false, error: e instanceof Error ? e.message : "Thất bại." }));
    }
  }

  if (state.done === "internal") {
    return (
      <div className="flex flex-col items-center px-6 pt-10 text-center">
        <CheckCircle2 size={64} className="text-income" />
        <h2 className="mt-4 text-[22px] font-extrabold text-ink">Đã nộp hồ sơ!</h2>
        <p className="mt-2 text-[15px] text-muted">Theo dõi trạng thái trong mục Ứng tuyển. PFC sẽ nhắc bạn khi có cập nhật.</p>
        <div className="mt-6 w-full space-y-3">
          <ButtonLink href="/opportunities/applications" block>
            Xem hồ sơ của tôi
          </ButtonLink>
          <ButtonLink href="/opportunities" variant="secondary" block>
            Khám phá thêm
          </ButtonLink>
        </div>
      </div>
    );
  }

  if (state.done === "external") {
    return (
      <div className="px-4 pt-6">
        <Card className="text-center">
          <ExternalLink size={40} className="mx-auto text-primary" />
          <h2 className="mt-3 text-[18px] font-bold text-ink">Hoàn tất trên trang của đơn vị</h2>
          <p className="mt-2 text-[14px] text-muted">
            PFC đã ghi nhận bạn mở trang ứng tuyển. Sau khi nộp xong ở đó, bấm xác nhận để PFC theo dõi và nhắc hạn.
          </p>
          <div className="mt-4 space-y-3">
            <Button block disabled={state.pending} onClick={confirmExternal}>
              {state.pending ? "Đang lưu…" : "Tôi đã nộp xong"}
            </Button>
            {o.externalUrl && (
              <a href={o.externalUrl} target="_blank" rel="noopener noreferrer" className="block text-[14px] font-semibold text-primary">
                Mở lại trang ứng tuyển
              </a>
            )}
            <Link href="/opportunities/applications" className="block text-[14px] text-muted">
              Để sau
            </Link>
          </div>
          <div className="mt-3">
            <FormError message={state.error} />
          </div>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-4 px-4 pt-2">
      <Card className="flex items-center gap-3 p-3.5">
        <div className="min-w-0">
          <p className="truncate text-[15px] font-bold text-ink">{o.title}</p>
          <p className="truncate text-[13px] text-muted">{o.provider?.displayName}</p>
        </div>
      </Card>
      {o.applyMode === "BOTH" && (
        <SegmentedTabs
          label="Cách ứng tuyển"
          stretch
          value={mode}
          onChange={setChannel}
          options={[
            { value: "INTERNAL", label: "Nộp trên PFC" },
            { value: "EXTERNAL", label: "Trang đơn vị" },
          ]}
        />
      )}
      {mode === "INTERNAL" ? (
        <>
          <div>
            <p className="mb-1.5 text-[13px] font-semibold text-ink-2">CV (PDF, DOC, DOCX · tối đa 5MB)</p>
            <input
              ref={fileInput}
              type="file"
              accept={CV_TYPES}
              className="sr-only"
              onChange={(e) => {
                const f = e.target.files?.[0] ?? null;
                if (f && f.size > 5 * 1024 * 1024) return setState({ error: "CV tối đa 5MB." });
                setState({});
                setFile(f);
              }}
            />
            <button
              type="button"
              onClick={() => fileInput.current?.click()}
              className="pressable flex w-full flex-col items-center gap-2 rounded-[var(--radius-card)] border-2 border-dashed border-line bg-surface px-4 py-6 text-[14px] text-ink-2"
            >
              <FileUp size={26} className="text-primary" />
              {file ? <span className="font-semibold text-ink">{file.name}</span> : "Chạm để tải CV lên"}
            </button>
            <p className="mt-1 text-[12px] text-muted">CV được lưu riêng tư; chỉ đơn vị tuyển dụng của tin này xem được.</p>
          </div>
          <TextArea label="Giới thiệu ngắn về bản thân" value={cover} onChange={(e) => setCover(e.target.value)} maxLength={5000} rows={5} />
          <FormError message={state.error} />
          <Button block disabled={state.pending} onClick={applyInternal}>
            {state.pending ? "Đang nộp…" : "Nộp hồ sơ"}
          </Button>
        </>
      ) : (
        <>
          <Card className="text-[14px] leading-relaxed text-ink-2">
            Cơ hội này nhận hồ sơ trên trang của đơn vị. PFC sẽ ghi nhận đơn ứng tuyển, mở trang đó trong tab mới, và tiếp tục nhắc hạn cho bạn.
          </Card>
          <FormError message={state.error} />
          <Button block disabled={state.pending} onClick={applyExternal}>
            <ExternalLink size={18} /> {state.pending ? "Đang mở…" : "Mở trang ứng tuyển"}
          </Button>
        </>
      )}
    </div>
  );
}

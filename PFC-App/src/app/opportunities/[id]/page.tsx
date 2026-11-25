"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { BadgeCheck, Bookmark, BookmarkCheck, Clock, Flag, MapPin, Monitor, SearchX } from "lucide-react";
import { useState } from "react";
import { hubFetch, useHub } from "@/platform/hub-proxy/client";
import { HubErrorState, ListSkeleton } from "@/platform/hub-proxy/HubStates";
import { OPP_RUN_HINT, useOppSession } from "@/modules/opportunity/session";
import { EMPLOYMENT_LABEL, TIER_LABEL, TYPE_LABEL, WORKMODE_LABEL, daysUntil, type Opportunity } from "@/modules/opportunity/types";
import { DeadlineText, TYPE_ICON } from "@/modules/opportunity/ui/OppCard";
import { useSaves } from "@/modules/opportunity/use-saves";
import { AppHeader, Badge, BottomSheet, Button, ButtonLink, EmptyState, HeaderIconButton, Section } from "@/ui";
import { FormError, TextArea } from "@/ui/Form";
import { cx } from "@/ui/cx";

const REPORT_REASONS = [
  { value: "SCAM", label: "Lừa đảo" },
  { value: "MISLEADING", label: "Thông tin sai lệch" },
  { value: "SPAM", label: "Spam" },
  { value: "INAPPROPRIATE", label: "Nội dung không phù hợp" },
  { value: "OTHER", label: "Khác" },
] as const;

function Block({ title, text }: { title: string; text: string | null }) {
  if (!text?.trim()) return null;
  return (
    <Section title={title}>
      <p className="text-[15px] leading-relaxed whitespace-pre-line text-ink-2">{text}</p>
    </Section>
  );
}

/** OPP-05 Detail (+ OPP-06…09 type variants) — mockup 56. */
export default function OpportunityDetailPage() {
  const { id } = useParams<{ id: string }>();
  const { data: o, error, loading, reload } = useHub<Opportunity>("opp", `/opportunities/${encodeURIComponent(id)}`);
  const saves = useSaves();
  const { user } = useOppSession();
  const [reportOpen, setReportOpen] = useState(false);
  const [reason, setReason] = useState<(typeof REPORT_REASONS)[number]["value"]>("SCAM");
  const [details, setDetails] = useState("");
  const [reportState, setReportState] = useState<{ pending?: boolean; error?: string; done?: boolean }>({});

  if (loading && !o) return <ListSkeleton rows={3} />;
  if (error?.status === 404 || (!o && !loading && !error)) {
    return (
      <>
        <AppHeader back backFallback="/opportunities" title="Chi tiết cơ hội" />
        <EmptyState icon={SearchX} title="Cơ hội không còn hiển thị" description="Cơ hội có thể đã hết hạn hoặc chưa được xác minh." />
      </>
    );
  }
  if (error || !o) {
    return (
      <>
        <AppHeader back backFallback="/opportunities" title="Chi tiết cơ hội" />
        {error && <HubErrorState error={error} onRetry={reload} hubName="Cơ hội" runHint={OPP_RUN_HINT} />}
      </>
    );
  }

  const Icon = TYPE_ICON[o.type];
  const tier = o.provider ? TIER_LABEL[o.provider.verificationTier] : null;
  const saved = saves.ids.has(o.id);
  const expired = (daysUntil(o.deadlineAt) ?? 1) < 0;

  async function submitReport() {
    setReportState({ pending: true });
    try {
      await hubFetch("opp", `/opportunities/${o!.id}/report`, { method: "POST", json: { reason, details: details.trim() || undefined } });
      setReportState({ done: true });
    } catch (e) {
      setReportState({ error: e instanceof Error ? e.message : "Gửi báo cáo thất bại." });
    }
  }

  return (
    <>
      <AppHeader
        back
        backFallback="/opportunities"
        title="Chi tiết cơ hội"
        actions={
          <HeaderIconButton label={saved ? "Bỏ lưu" : "Lưu cơ hội"} onClick={() => saves.toggle(o.id)}>
            {saved ? <BookmarkCheck size={22} className="text-primary" /> : <Bookmark size={22} />}
          </HeaderIconButton>
        }
      />
      <div className="px-4">
        <div className="flex h-28 items-center justify-center rounded-[var(--radius-card)] bg-primary text-on-primary">
          <Icon size={44} />
        </div>
        <h1 className="mt-4 text-[22px] leading-tight font-extrabold text-ink">{o.title}</h1>
        {o.provider && (
          <p className="mt-1 flex items-center gap-1.5 text-[14px] text-ink-2">
            {o.provider.displayName}
            {tier && (
              <span className="inline-flex items-center gap-1 text-[12px] font-semibold text-primary">
                <BadgeCheck size={16} /> {tier}
              </span>
            )}
          </p>
        )}
        <div className="mt-3 flex flex-wrap gap-2">
          <Badge>{TYPE_LABEL[o.type]}</Badge>
          {o.employmentType && <Badge tone="muted">{EMPLOYMENT_LABEL[o.employmentType]}</Badge>}
          <Badge tone="muted">{WORKMODE_LABEL[o.workMode]}</Badge>
        </div>
        <ul className="mt-3 space-y-1.5 text-[14px]">
          {o.locationText && (
            <li className="flex items-center gap-2 text-ink-2">
              <MapPin size={16} className="text-muted" /> {o.locationText}
            </li>
          )}
          <li className="flex items-center gap-2">
            <Clock size={16} className="text-muted" /> <DeadlineText deadline={o.deadlineAt} />
          </li>
          <li className="flex items-center gap-2 text-ink-2">
            <Monitor size={16} className="text-muted" />
            {o.applyMode === "EXTERNAL" ? "Ứng tuyển trên trang của đơn vị" : o.applyMode === "INTERNAL" ? "Ứng tuyển trực tiếp trên PFC" : "Ứng tuyển trên PFC hoặc trang đơn vị"}
          </li>
        </ul>
      </div>
      {o.summary && <Block title="Tóm tắt" text={o.summary} />}
      <Block title="Mô tả công việc" text={o.description} />
      <Block title="Yêu cầu" text={o.requirements} />
      <Block title="Quyền lợi" text={o.benefits} />
      <Section>
        <button type="button" onClick={() => (user ? setReportOpen(true) : undefined)} className="flex items-center gap-2 text-[13px] text-muted" disabled={!user}>
          <Flag size={15} /> {user ? "Báo cáo tin này" : "Đăng nhập để báo cáo tin này"}
        </button>
      </Section>

      {/* Sticky apply bar (mockup 56: Lưu · Ứng tuyển) */}
      <div className="fixed-in-canvas bottom-[calc(var(--tabbar-h)+var(--safe-bottom))] z-30 border-t border-line bg-surface/95 px-4 py-3 backdrop-blur-md">
        <div className="grid grid-cols-[auto_1fr] gap-3">
          <Button variant="secondary" onClick={() => saves.toggle(o.id)} aria-pressed={saved}>
            {saved ? <BookmarkCheck size={18} /> : <Bookmark size={18} />} {saved ? "Đã lưu" : "Lưu"}
          </Button>
          {expired ? (
            <Button disabled>Đã hết hạn</Button>
          ) : (
            <ButtonLink href={user ? `/opportunities/${o.id}/apply` : "/opportunities/account"}>Ứng tuyển</ButtonLink>
          )}
        </div>
      </div>
      <div className="h-20" aria-hidden="true" />

      <BottomSheet
        open={reportOpen}
        onClose={() => {
          setReportOpen(false);
          setReportState({});
        }}
        title="Báo cáo tin tuyển dụng"
        footer={
          !reportState.done && (
            <Button block disabled={reportState.pending} onClick={submitReport}>
              {reportState.pending ? "Đang gửi…" : "Gửi báo cáo"}
            </Button>
          )
        }
      >
        {reportState.done ? (
          <p className="py-6 text-center text-[15px] text-ink-2">Cảm ơn bạn. Đội ngũ kiểm duyệt PFC sẽ xem xét tin này.</p>
        ) : (
          <div className="space-y-3">
            <div className="flex flex-wrap gap-2" role="radiogroup" aria-label="Lý do">
              {REPORT_REASONS.map((r) => (
                <button
                  key={r.value}
                  type="button"
                  role="radio"
                  aria-checked={reason === r.value}
                  onClick={() => setReason(r.value)}
                  className={cx(
                    "pressable rounded-full px-4 py-2 text-[14px] font-semibold",
                    reason === r.value ? "bg-primary text-on-primary" : "border border-line text-ink-2",
                  )}
                >
                  {r.label}
                </button>
              ))}
            </div>
            <TextArea label="Chi tiết (không bắt buộc)" value={details} onChange={(e) => setDetails(e.target.value)} maxLength={2000} />
            <FormError message={reportState.error} />
          </div>
        )}
      </BottomSheet>
      {!user && (
        <p className="sr-only">
          <Link href="/opportunities/account">Đăng nhập để lưu và ứng tuyển</Link>
        </p>
      )}
    </>
  );
}

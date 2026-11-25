import { notFound } from "next/navigation";
import { requireMember, toActor } from "@/platform/auth/session";
import { formatVnd } from "@/lib/money";
import { hooksFor, isRefType } from "@/modules/payments/server/hooks";
import { REFUND_REASONS, type RefundReason } from "@/modules/payments/server/service";
import { RefundRequestForm } from "@/modules/payments/ui/PaymentClient";
import { AppHeader, Section } from "@/ui";

export const metadata = { title: "Yêu cầu hoàn tiền" };
export const dynamic = "force-dynamic";

const BY_TYPE: Record<string, RefundReason[]> = {
  evt_registration: ["cannot_attend", "duplicate", "technical", "other"],
  mkt_order: ["not_received", "not_as_described", "duplicate", "technical", "other"],
};

/** PAY-08 / MKT-20 Refund request (mockup 68). ?ref=<type>:<id> */
export default async function NewRefundPage({ searchParams }: { searchParams: Promise<{ ref?: string }> }) {
  const { ref = "" } = await searchParams;
  const me = await requireMember(`/payments/refunds/new?ref=${encodeURIComponent(ref)}`);
  const [refType, refId] = ref.split(":");
  if (!isRefType(refType) || !refId) notFound();
  const h = await hooksFor(refType);
  const check = await h.refundCheck(toActor(me), refId);
  const desc = await h.describe(refId);
  return (
    <>
      <AppHeader back backFallback={desc.href} title="Yêu cầu hoàn tiền" />
      <Section>
        <div className="rounded-xl bg-surface-2 px-4 py-3">
          <p className="text-[15px] font-bold text-ink">{desc.title}</p>
          {check.ok && <p className="text-[13px] text-muted">Số tiền hoàn: {formatVnd(check.amount)} · về đúng thẻ / tài khoản đã thanh toán</p>}
        </div>
      </Section>
      {check.ok ? (
        <div className="pt-4">
          <RefundRequestForm refType={refType} refId={refId} backHref={desc.href} reasons={BY_TYPE[refType].map((k) => [k, REFUND_REASONS[k]])} />
        </div>
      ) : (
        <Section>
          <p className="rounded-xl bg-expense-soft px-4 py-3 text-[14px] text-expense">{check.error}</p>
        </Section>
      )}
    </>
  );
}

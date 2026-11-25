import Link from "next/link";
import { notFound } from "next/navigation";
import { requireMember, toActor } from "@/platform/auth/session";
import { formatVnd } from "@/lib/money";
import { REFUND_REASONS, REFUND_STATUS_LABEL, getRefund } from "@/modules/payments/server/service";
import { MarkRefunded, RefundDecision } from "@/modules/payments/ui/PaymentClient";
import { REFUND_TONE, vnTime } from "@/modules/payments/ui/format";
import { AppHeader, Badge, Card, Section } from "@/ui";
import { cx } from "@/ui/cx";

export const metadata = { title: "Hoàn tiền" };
export const dynamic = "force-dynamic";

/** PAY-08/09 Refund status timeline (mockup 69) + decision for payee / Chủ nhiệm. */
export default async function RefundPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const me = await requireMember(`/payments/refunds/${id}`);
  const r = await getRefund(toActor(me), id);
  if (!r) notFound();
  return (
    <>
      <AppHeader back backFallback="/payments" title="Hoàn tiền" />
      <Section>
        <Card>
          <div className="flex items-start justify-between gap-3">
            <div>
              <Link href={r.href} className="text-[15px] font-bold text-ink">
                {r.title}
              </Link>
              <p className="text-[24px] font-extrabold text-ink">{formatVnd(r.amount)}</p>
            </div>
            <Badge tone={REFUND_TONE[r.status]}>{REFUND_STATUS_LABEL[r.status]}</Badge>
          </div>
          <p className="mt-2 text-[14px] text-ink-2">
            <span className="font-semibold">{REFUND_REASONS[r.reason]}</span> — {r.details}
          </p>
          {r.decisionNote && r.status === "rejected" && <p className="mt-2 rounded-xl bg-expense-soft px-3 py-2 text-[13px] text-expense">Lý do từ chối: {r.decisionNote}</p>}
        </Card>
      </Section>
      <Section title="Tiến trình">
        <ol className="relative ml-2 space-y-4 border-l-2 border-line pl-5">
          {r.timeline.map((t, i) => (
            <li key={i} className="relative">
              <span className={cx("absolute top-1 -left-[27px] size-3 rounded-full", i === r.timeline.length - 1 ? "bg-primary" : "bg-line")} />
              <p className="text-[14px] font-semibold text-ink">{REFUND_STATUS_LABEL[t.status]}</p>
              {t.note && <p className="text-[13px] text-ink-2">{t.note}</p>}
              <p className="text-[12px] text-muted">{vnTime(t.at)}</p>
            </li>
          ))}
        </ol>
      </Section>
      {r.canDecide && (
        <Section>
          <RefundDecision id={r.id} />
        </Section>
      )}
      {r.canFinish && (
        <Section title="Hoàn tiền thủ công">
          <p className="mb-2 text-[13px] text-muted">Cổng VNPAY chưa xác nhận hoàn tiền. Sau khi chuyển khoản trả lại cho người mua, ghi mã tham chiếu để đóng yêu cầu.</p>
          <MarkRefunded id={r.id} />
        </Section>
      )}
      <div className="h-6" />
    </>
  );
}

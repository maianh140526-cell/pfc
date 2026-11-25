import Link from "next/link";
import { notFound } from "next/navigation";
import { CheckCircle2, Clock, XCircle } from "lucide-react";
import { requireMember, toActor } from "@/platform/auth/session";
import { formatVnd } from "@/lib/money";
import { PAYMENT_STATUS_LABEL, REFUND_STATUS_LABEL, getPayment } from "@/modules/payments/server/service";
import { responseMessage } from "@/modules/payments/domain/vnpay";
import { PAY_TONE, REFUND_TONE, vnTime } from "@/modules/payments/ui/format";
import { AppHeader, Badge, ButtonLink, Card, Section } from "@/ui";

export const metadata = { title: "Giao dịch" };
export const dynamic = "force-dynamic";

/** PAY-04/05/06 Payment result (success / failed / pending) and detail. */
export default async function PaymentPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ from?: string }> }) {
  const { id } = await params;
  const { from } = await searchParams;
  const me = await requireMember(`/payments/${id}`);
  const p = await getPayment(toActor(me), id);
  if (!p) notFound();
  const ok = p.status === "succeeded" || p.status === "refunded" || p.status === "partially_refunded";
  const pending = p.status === "pending";
  const Icon = ok ? CheckCircle2 : pending ? Clock : XCircle;
  const title = ok ? "Thanh toán thành công" : pending ? "Đang chờ xác nhận" : p.status === "expired" ? "Giao dịch đã hết hạn" : "Thanh toán chưa thành công";
  const next = p.items[0];
  return (
    <>
      <AppHeader back={from !== "vnpay"} backHref={from === "vnpay" ? "/payments" : undefined} backFallback="/payments" title="Giao dịch" />
      <Section>
        <Card className="text-center">
          <Icon size={56} className={`mx-auto ${ok ? "text-income" : pending ? "text-warning" : "text-expense"}`} />
          <p className="mt-2 text-[20px] font-extrabold text-ink">{title}</p>
          <p className="mt-1 text-[26px] font-extrabold text-ink">{formatVnd(p.amount)}</p>
          {!ok && !pending && p.responseCode && <p className="mt-1 text-[13px] text-muted">{responseMessage(p.responseCode)}</p>}
          {pending && <p className="mt-1 text-[13px] text-muted">Nếu bạn đã thanh toán, kết quả sẽ cập nhật trong ít phút. Tải lại trang để kiểm tra.</p>}
          <div className="mt-2">
            <Badge tone={PAY_TONE[p.status]}>{PAYMENT_STATUS_LABEL[p.status]}</Badge>
          </div>
        </Card>
      </Section>
      <Section title="Chi tiết">
        <dl className="space-y-2 text-[14px]">
          {[
            ["Nội dung", p.description],
            ["Mã giao dịch PFC", p.txnRef],
            ["Cổng thanh toán", `VNPAY${p.bankCode ? ` · ${p.bankCode}` : ""}`],
            ["Tạo lúc", vnTime(p.createdAt)],
            ...(p.paidAt ? [["Thanh toán lúc", vnTime(p.paidAt)]] : []),
          ].map(([k, v]) => (
            <div key={k} className="flex justify-between gap-4">
              <dt className="text-muted">{k}</dt>
              <dd className="text-right font-semibold break-all text-ink">{v}</dd>
            </div>
          ))}
        </dl>
      </Section>
      <Section title="Thanh toán cho">
        <ul className="space-y-2">
          {p.items.map((i) => (
            <li key={`${i.refType}:${i.refId}`}>
              <Link href={i.href} className="pressable flex justify-between gap-3 rounded-xl border border-line bg-surface px-4 py-3 text-[14px]">
                <span className="font-semibold text-ink">{i.title}</span>
                <span className="text-ink">{formatVnd(i.amount)}</span>
              </Link>
            </li>
          ))}
        </ul>
      </Section>
      {p.refunds.length > 0 && (
        <Section title="Hoàn tiền">
          <ul className="space-y-2">
            {p.refunds.map((r) => (
              <li key={r.id}>
                <Link href={`/payments/refunds/${r.id}`} className="pressable flex items-center justify-between gap-3 rounded-xl border border-line bg-surface px-4 py-3 text-[14px]">
                  <span className="font-semibold text-ink">{formatVnd(r.amount)}</span>
                  <Badge tone={REFUND_TONE[r.status]}>{REFUND_STATUS_LABEL[r.status]}</Badge>
                </Link>
              </li>
            ))}
          </ul>
        </Section>
      )}
      {next && p.mine && (
        <Section>
          <div className="pb-4">
            <ButtonLink href={next.href} block>
              {next.refType === "evt_registration" ? "Xem vé" : "Xem đơn hàng"}
            </ButtonLink>
          </div>
        </Section>
      )}
    </>
  );
}

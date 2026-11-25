import Link from "next/link";
import { notFound } from "next/navigation";
import { requireMember, toActor } from "@/platform/auth/session";
import { formatVnd } from "@/lib/money";
import { ORDER_STATUS_LABEL, ORDER_TONE, PAYMENT_LABEL, type OrderStatus } from "@/modules/market/domain/orders";
import { getOrder } from "@/modules/market/server/service";
import { REFUND_STATUS_LABEL, onlinePaymentEnabled, paymentForRef, refundForRef } from "@/modules/payments/server/service";
import { AppHeader, Badge, ButtonLink, Card, Section } from "@/ui";
import { cx } from "@/ui/cx";
import { AttachmentList } from "@/ui/AttachmentPicker";
import { OrderActions, PayOrderButton, ReviewButton } from "./OrderClient";

export const dynamic = "force-dynamic";

const EVENT_LABEL: Record<string, string> = { ...ORDER_STATUS_LABEL, paid: "Đã thanh toán", refunded: "Đã hoàn tiền", stock_released: "Trả lại hàng vào kho" };
const PAY_STATUS: Record<string, string> = { unpaid: "Chưa thanh toán", paid: "Đã thanh toán", refunded: "Đã hoàn tiền" };

/** MKT-17 Order Detail / SELL-11 Seller Order Detail (mockup 66). Visible to buyer and seller only. */
export default async function OrderPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const me = await requireMember(`/market/orders/${id}`);
  const o = await getOrder(toActor(me), id);
  if (!o) notFound();
  const vnpay = o.paymentMethod === "vnpay";
  const [payment, refund] = vnpay ? await Promise.all([paymentForRef("mkt_order", id), refundForRef("mkt_order", id)]) : [null, null];
  const canPay = vnpay && o.role === "buyer" && o.status === "placed" && o.paymentStatus === "unpaid" && onlinePaymentEnabled();
  const canAskRefund = vnpay && o.role === "buyer" && o.paymentStatus === "paid" && o.status !== "cancelled" && !refund;
  return (
    <>
      <AppHeader back backFallback={o.role === "buyer" ? "/market/orders" : "/market/sell/orders"} title="Chi tiết đơn hàng" />
      <div className="px-4">
        <div className="flex items-center justify-between gap-2">
          <p className="text-[17px] font-extrabold text-ink">#{o.code}</p>
          <Badge tone={ORDER_TONE[o.status]}>{ORDER_STATUS_LABEL[o.status]}</Badge>
        </div>
        <p className="text-[13px] text-muted">{new Date(o.createdAt).toLocaleString("vi-VN")}</p>
      </div>
      <Section title="Sản phẩm">
        <Card className="space-y-3">
          {o.items.map((i) => (
            <div key={i.listingId} className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <Link href={`/market/p/${i.listingId}`} className="text-[14px] font-semibold text-ink">
                  {i.title}
                </Link>
                <p className="text-[13px] text-muted">
                  {formatVnd(i.unitPrice)} × {i.qty}
                </p>
              </div>
              {o.canReview && !i.reviewed && <ReviewButton orderId={o.id} listingId={i.listingId} title={i.title} />}
              {i.reviewed && <Badge tone="income">Đã đánh giá</Badge>}
            </div>
          ))}
          <p className="flex justify-between border-t border-line pt-2 text-[15px]">
            <span className="text-ink-2">Tổng cộng</span>
            <b className="text-primary">{formatVnd(o.total)}</b>
          </p>
        </Card>
      </Section>
      {o.items.some((i) => i.access) && (
        <Section title="Nhận hàng số / truy cập">
          <Card className="space-y-4">
            {o.items
              .filter((i) => i.access)
              .map((i) => (
                <div key={i.listingId} className="space-y-2">
                  <p className="text-[14px] font-semibold text-ink">{i.title}</p>
                  {i.access!.courseId && (
                    <ButtonLink href={`/learn/courses/${i.access!.courseId}`} variant="secondary" block>
                      Vào khóa học
                    </ButtonLink>
                  )}
                  {i.access!.fileUrl && <AttachmentList items={[{ url: i.access!.fileUrl, name: i.access!.fileName || "Tệp đã mua", kind: "file" }]} />}
                  {i.access!.info && <p className="rounded-xl bg-surface-2 px-3 py-2 text-[14px] whitespace-pre-line text-ink-2">{i.access!.info}</p>}
                  {!i.access!.fileUrl && !i.access!.info && !i.access!.courseId && <p className="text-[13px] text-muted">Người bán sẽ gửi tài liệu cho bạn qua liên hệ của cửa hàng.</p>}
                </div>
              ))}
          </Card>
          {o.role === "buyer" && <p className="mt-2 text-[12px] text-muted">Chỉ hiện sau khi đơn được thanh toán.</p>}
        </Section>
      )}
      <Section title="Thanh toán & giao nhận">
        <dl className="divide-y divide-line rounded-[var(--radius-card)] border border-line bg-surface text-[14px]">
          {[
            ["Phương thức", PAYMENT_LABEL[o.paymentMethod]],
            ["Thanh toán", PAY_STATUS[o.paymentStatus] ?? o.paymentStatus],
            [o.role === "buyer" ? "Người bán" : "Người mua", o.role === "buyer" ? o.shopName : o.buyerName],
            ...(o.role === "buyer" && o.sellerContact ? [["Liên hệ người bán", o.sellerContact]] : []),
            ["Người nhận", `${o.recipientName} · ${o.recipientPhone}`],
            ...(o.address ? [["Địa chỉ", o.address]] : []),
            ...(o.note ? [["Ghi chú", o.note]] : []),
            ...(o.cancelReason ? [["Lý do hủy", o.cancelReason]] : []),
          ].map(([k, v]) => (
            <div key={k} className="flex justify-between gap-4 px-4 py-2.5">
              <dt className="shrink-0 text-muted">{k}</dt>
              <dd className="text-right font-medium break-words text-ink">{v}</dd>
            </div>
          ))}
        </dl>
      </Section>
      {(canPay || canAskRefund || refund || payment) && (
        <Section>
          <div className="space-y-2">
            {canPay && <PayOrderButton orderId={o.id} />}
            {refund && (
              <ButtonLink href={`/payments/refunds/${refund.id}`} variant="secondary" block>
                Hoàn tiền: {REFUND_STATUS_LABEL[refund.status]}
              </ButtonLink>
            )}
            {canAskRefund && (
              <ButtonLink href={`/payments/refunds/new?ref=mkt_order:${o.id}`} variant="ghost" block>
                Yêu cầu hoàn tiền
              </ButtonLink>
            )}
            {payment && (
              <ButtonLink href={`/payments/${payment.id}`} variant="ghost" block>
                Xem giao dịch VNPAY
              </ButtonLink>
            )}
          </div>
        </Section>
      )}
      {o.actions.length > 0 && (
        <Section>
          <OrderActions orderId={o.id} actions={o.actions} role={o.role} paymentMethod={o.paymentMethod} />
        </Section>
      )}
      <Section title="Lịch sử đơn hàng">
        <ol className="rounded-[var(--radius-card)] border border-line bg-surface px-4 py-3">
          {o.events.map((e, i) => (
            <li key={i} className="relative flex gap-3 pb-3 last:pb-0">
              <span className={cx("mt-1.5 size-2.5 shrink-0 rounded-full", i === o.events.length - 1 ? "bg-primary" : "bg-line")} />
              <span>
                <span className="block text-[14px] font-semibold text-ink">{EVENT_LABEL[e.status as OrderStatus] ?? e.status}</span>
                <span className="block text-[12px] text-muted">
                  {new Date(e.at).toLocaleString("vi-VN")}
                  {e.note ? ` · ${e.note}` : ""}
                </span>
              </span>
            </li>
          ))}
        </ol>
      </Section>
    </>
  );
}

import { notFound } from "next/navigation";
import QRCode from "qrcode";
import { CheckCircle2, ExternalLink, MapPin, Video } from "lucide-react";
import { requireMember, toActor } from "@/platform/auth/session";
import { formatVnd } from "@/lib/money";
import { ticketPayload } from "@/modules/events/domain/events";
import { getTicket } from "@/modules/events/server/service";
import { onlinePaymentEnabled, paymentForRef, refundForRef, REFUND_STATUS_LABEL } from "@/modules/payments/server/service";
import { TicketActions } from "@/modules/events/ui/EventClient";
import { REG_STATUS_LABEL, REG_STATUS_TONE, eventWhen } from "@/modules/events/ui/format";
import { AppHeader, Badge, ButtonLink, Card, Section } from "@/ui";

export const metadata = { title: "Vé sự kiện" };
export const dynamic = "force-dynamic";

/** EVT-14 Ticket with QR for check-in (mockup 72 → ticket). */
export default async function TicketPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const me = await requireMember(`/events/tickets/${id}`);
  const t = await getTicket(toActor(me), id);
  if (!t) notFound();
  const valid = t.status === "confirmed";
  const qr = valid ? await QRCode.toString(ticketPayload(t.ticketCode), { type: "svg", margin: 1, errorCorrectionLevel: "M" }) : null;
  const [payment, refund] = await Promise.all([paymentForRef("evt_registration", id), refundForRef("evt_registration", id)]);
  const started = t.startsAt <= new Date(Date.now() + 7 * 3600_000).toISOString().slice(0, 16);
  const paidOnline = t.paid && t.price > 0 && payment?.status === "succeeded";
  return (
    <>
      <AppHeader back backFallback="/events/tickets" title="Vé của tôi" />
      <Section>
        <Card className="text-center">
          <p className="text-[17px] font-extrabold text-ink">{t.eventTitle}</p>
          <p className="mt-1 text-[13px] font-semibold text-primary">{eventWhen(t.startsAt, t.endsAt)}</p>
          <div className="mt-2">
            <Badge tone={REG_STATUS_TONE[t.status]}>{REG_STATUS_LABEL[t.status]}</Badge>
          </div>
          {qr ? (
            <div className="mx-auto mt-4 w-[220px] rounded-2xl bg-white p-3" aria-label={`Mã QR vé ${t.ticketCode}`} role="img" dangerouslySetInnerHTML={{ __html: qr }} />
          ) : null}
          {valid && <p className="mt-2 font-mono text-[18px] font-bold tracking-[0.2em] text-ink">{t.ticketCode}</p>}
          {t.checkedInAt && (
            <p className="mt-2 inline-flex items-center gap-1 text-[13px] font-semibold text-income">
              <CheckCircle2 size={16} /> Đã check-in
            </p>
          )}
          <dl className="mt-4 space-y-1 border-t border-dashed border-line pt-3 text-left text-[14px]">
            <div className="flex justify-between gap-3">
              <dt className="text-muted">Người tham dự</dt>
              <dd className="font-semibold text-ink">{t.attendeeName}</dd>
            </div>
            <div className="flex justify-between gap-3">
              <dt className="text-muted">Loại vé</dt>
              <dd className="font-semibold text-ink">{t.ticketName}</dd>
            </div>
            <div className="flex justify-between gap-3">
              <dt className="text-muted">Giá</dt>
              <dd className="font-semibold text-ink">
                {t.price ? formatVnd(t.price) : "Miễn phí"}
                {t.price > 0 && !t.paid && t.status === "confirmed" && " · trả tại quầy"}
              </dd>
            </div>
          </dl>
        </Card>
      </Section>
      <Section>
        <div className="space-y-2 text-[14px]">
          {t.mode !== "online" && (
            <p className="flex gap-2 text-ink">
              <MapPin size={18} className="shrink-0 text-primary" /> {t.location}
            </p>
          )}
          {t.onlineUrl && (
            <a href={t.onlineUrl} target="_blank" rel="noopener noreferrer" className="flex items-center gap-2 font-semibold text-primary">
              <Video size={18} /> Link tham gia trực tuyến <ExternalLink size={14} />
            </a>
          )}
          {valid && <p className="text-[12px] text-muted">Đưa mã QR này cho ban tổ chức khi đến. Không chia sẻ mã cho người khác.</p>}
          {t.status === "pending_payment" && t.holdUntil && <p className="text-[13px] text-warning">Chỗ được giữ tới {new Date(t.holdUntil).toLocaleTimeString("vi-VN", { timeZone: "Asia/Ho_Chi_Minh", hour: "2-digit", minute: "2-digit" })}.</p>}
        </div>
      </Section>
      {t.isMine && (
        <Section>
          <div className="space-y-2 pb-4">
            <TicketActions
              registrationId={t.id}
              status={t.status}
              payPending={onlinePaymentEnabled()}
              canCancel={!started && (t.status === "pending_payment" || (t.status === "confirmed" && !(t.price > 0 && t.paid)))}
            />
            {refund ? (
              <ButtonLink href={`/payments/refunds/${refund.id}`} variant="secondary" block>
                Hoàn tiền: {REFUND_STATUS_LABEL[refund.status]}
              </ButtonLink>
            ) : paidOnline && t.status === "confirmed" && !t.checkedInAt && t.eventStatus !== "completed" ? (
              <ButtonLink href={`/payments/refunds/new?ref=evt_registration:${t.id}`} variant="ghost" block>
                Yêu cầu hoàn tiền
              </ButtonLink>
            ) : null}
            {payment && (
              <ButtonLink href={`/payments/${payment.id}`} variant="ghost" block>
                Xem giao dịch thanh toán
              </ButtonLink>
            )}
            <ButtonLink href={`/events/${t.eventId}`} variant="ghost" block>
              Xem sự kiện
            </ButtonLink>
          </div>
        </Section>
      )}
    </>
  );
}

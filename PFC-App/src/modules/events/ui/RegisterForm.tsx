"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { formatVnd } from "@/lib/money";
import { Button } from "@/ui";
import { FormError, TextInput } from "@/ui/Form";
import { cx } from "@/ui/cx";
import { useAction } from "@/ui/use-action";
import { registerAction } from "../server/actions";
import type { TicketType } from "../server/service";

/** EVT-07/08 Registration (mockup 72): pick a ticket, attendee details, then free → ticket, paid → VNPAY. */
export function RegisterForm({ eventId, tickets, payAtDoor, onlinePayments, defaults }: { eventId: string; tickets: TicketType[]; payAtDoor: boolean; onlinePayments: boolean; defaults: { name: string; email: string; phone: string } }) {
  const router = useRouter();
  const a = useAction();
  const available = tickets.filter((t) => t.left === null || t.left > 0);
  const [ticketTypeId, setTicket] = useState(available[0]?.id ?? "");
  const [v, setV] = useState(defaults);
  const chosen = tickets.find((t) => t.id === ticketTypeId);
  const paidOnline = !!chosen && chosen.price > 0 && !payAtDoor;
  const blocked = paidOnline && !onlinePayments;
  return (
    <form
      className="space-y-4 px-4 pt-2 pb-6"
      noValidate
      onSubmit={(e) => {
        e.preventDefault();
        a.run(
          () => registerAction(eventId, { ticketTypeId, ...v }),
          (r) => {
            if (r.payUrl) window.location.href = r.payUrl;
            else router.replace(`/events/tickets/${r.registrationId}`);
          },
        );
      }}
    >
      <fieldset className="space-y-2">
        <legend className="mb-2 text-[15px] font-bold text-ink">Chọn loại vé</legend>
        {tickets.map((t) => {
          const soldOut = t.left !== null && t.left <= 0;
          return (
            <label
              key={t.id}
              className={cx(
                "flex cursor-pointer items-center gap-3 rounded-xl border px-4 py-3",
                ticketTypeId === t.id ? "border-primary bg-primary-soft" : "border-line bg-surface",
                soldOut && "cursor-not-allowed opacity-50",
              )}
            >
              <input type="radio" name="ticket" value={t.id} checked={ticketTypeId === t.id} disabled={soldOut} onChange={() => setTicket(t.id)} className="accent-[var(--color-primary)]" />
              <span className="min-w-0 flex-1">
                <span className="block text-[14px] font-semibold text-ink">{t.name}</span>
                {t.description && <span className="block text-[12px] text-muted">{t.description}</span>}
                {t.left !== null && <span className="block text-[12px] text-muted">{soldOut ? "Hết vé" : `Còn ${t.left} vé`}</span>}
              </span>
              <span className="text-[15px] font-bold text-ink">{t.price ? formatVnd(t.price) : "Miễn phí"}</span>
            </label>
          );
        })}
      </fieldset>
      <TextInput label="Họ tên người tham dự" value={v.name} onChange={(e) => setV({ ...v, name: e.target.value })} autoComplete="name" maxLength={80} />
      <TextInput label="Email nhận vé" type="email" value={v.email} onChange={(e) => setV({ ...v, email: e.target.value })} autoComplete="email" />
      <TextInput label="Số điện thoại" hint="Không bắt buộc" type="tel" value={v.phone} onChange={(e) => setV({ ...v, phone: e.target.value })} autoComplete="tel" />
      {chosen && chosen.price > 0 && (
        <p className="rounded-xl bg-surface-2 px-4 py-3 text-[13px] text-ink-2">
          {payAtDoor
            ? `Thanh toán ${formatVnd(chosen.price)} tại quầy check-in.`
            : onlinePayments
              ? `Thanh toán ${formatVnd(chosen.price)} qua VNPAY (thẻ ATM, QR ngân hàng, thẻ quốc tế). Chỗ được giữ 15 phút.`
              : "Cổng thanh toán trực tuyến chưa được bật nên chưa thể mua vé có phí."}
        </p>
      )}
      <FormError message={a.error} />
      <Button type="submit" block disabled={a.pending || !ticketTypeId || blocked}>
        {a.pending ? "Đang xử lý…" : paidOnline ? `Thanh toán ${formatVnd(chosen!.price)}` : "Xác nhận đăng ký"}
      </Button>
      <p className="text-[12px] text-muted">Thông tin chỉ được chia sẻ với ban tổ chức sự kiện để check-in và liên hệ.</p>
    </form>
  );
}

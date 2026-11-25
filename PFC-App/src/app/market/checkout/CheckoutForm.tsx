"use client";

import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { formatVnd } from "@/lib/money";
import { PAYMENT_LABEL, type PaymentMethod } from "@/modules/market/domain/orders";
import { checkoutAction, checkoutVnpayAction } from "@/modules/market/server/actions";
import { Button, Card, Section } from "@/ui";
import { FormError, TextArea, TextInput } from "@/ui/Form";
import { useAction } from "@/ui/use-action";
import { cx } from "@/ui/cx";

export function CheckoutForm({
  defaultName,
  needsAddress,
  total,
  groups,
  vnpay,
}: {
  vnpay: boolean;
  defaultName: string;
  needsAddress: boolean;
  total: number;
  groups: Array<{ shopName: string; total: number; items: Array<{ title: string; qty: number; price: number }> }>;
}) {
  const router = useRouter();
  const offline: PaymentMethod[] = needsAddress ? ["cod", "bank_transfer"] : ["in_person", "bank_transfer"];
  const methods: PaymentMethod[] = vnpay && total >= 5_000 ? ["vnpay", ...offline] : offline;
  const [method, setMethod] = useState<PaymentMethod>(methods[0]);
  const [name, setName] = useState(defaultName);
  const [phone, setPhone] = useState("");
  const [address, setAddress] = useState("");
  const [note, setNote] = useState("");
  // One key per checkout screen: a double tap or a retry after a network error never creates a second order.
  const checkoutKey = useMemo(() => `co-${crypto.randomUUID()}`, []);
  const { run, pending, error } = useAction();

  return (
    <form
      noValidate
      onSubmit={(e) => {
        e.preventDefault();
        const input = { paymentMethod: method, recipientName: name, recipientPhone: phone.replace(/\s/g, ""), address, note, checkoutKey };
        if (method === "vnpay") run(() => checkoutVnpayAction(input), (r) => (window.location.href = r.payUrl));
        else run(() => checkoutAction(input), (ids) => router.replace(`/market/orders?placed=${ids.length}`));
      }}
    >
      <Section title="Thông tin nhận hàng">
        <div className="space-y-3">
          <TextInput label="Người nhận" value={name} onChange={(e) => setName(e.target.value)} autoComplete="name" />
          <TextInput label="Số điện thoại" type="tel" inputMode="tel" autoComplete="tel" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="0901234567" />
          {needsAddress && <TextArea label="Địa chỉ giao hàng" value={address} onChange={(e) => setAddress(e.target.value)} maxLength={300} rows={2} autoComplete="street-address" />}
          <TextArea label="Ghi chú cho người bán (không bắt buộc)" value={note} onChange={(e) => setNote(e.target.value)} maxLength={500} rows={2} />
        </div>
      </Section>
      <Section title="Phương thức thanh toán">
        <div className="space-y-2" role="radiogroup" aria-label="Phương thức thanh toán">
          {methods.map((m) => (
            <button
              key={m}
              type="button"
              role="radio"
              aria-checked={method === m}
              onClick={() => setMethod(m)}
              className={cx("pressable flex w-full items-center gap-3 rounded-2xl border-2 p-3.5 text-left text-[15px]", method === m ? "border-primary bg-primary-soft font-semibold text-ink" : "border-line bg-surface text-ink-2")}
            >
              <span className={cx("size-5 shrink-0 rounded-full border-2", method === m ? "border-primary bg-primary" : "border-line")} />
              {PAYMENT_LABEL[m]}
            </button>
          ))}
        </div>
        <p className="mt-2 text-[12px] leading-relaxed text-muted">
          {method === "vnpay"
            ? "Bạn được chuyển tới VNPAY (thẻ ATM, QR ngân hàng, thẻ quốc tế). PFC giữ tiền tới khi đơn hoàn tất; đơn bị hủy được hoàn tiền tự động. Hàng được giữ 15 phút."
            : "Bạn thanh toán trực tiếp cho người bán theo cách đã chọn; PFC không thu hộ khoản này."}
        </p>
      </Section>
      <Section title="Đơn hàng">
        <Card className="space-y-3">
          {groups.map((g) => (
            <div key={g.shopName}>
              <p className="text-[13px] font-bold text-ink">{g.shopName}</p>
              {g.items.map((i) => (
                <p key={i.title} className="flex justify-between gap-2 text-[13px] text-ink-2">
                  <span className="truncate">
                    {i.title} × {i.qty}
                  </span>
                  <span>{formatVnd(i.price * i.qty)}</span>
                </p>
              ))}
            </div>
          ))}
          <p className="flex items-baseline justify-between border-t border-line pt-2">
            <span className="text-[15px] font-semibold text-ink">Tổng thanh toán</span>
            <span className="text-[20px] font-extrabold text-primary">{formatVnd(total)}</span>
          </p>
        </Card>
      </Section>
      <Section>
        <FormError message={error} />
        <Button type="submit" block disabled={pending} className="mt-2">
          {pending ? "Đang đặt hàng…" : method === "vnpay" ? `Thanh toán · ${formatVnd(total)}` : `Đặt hàng · ${formatVnd(total)}`}
        </Button>
      </Section>
    </form>
  );
}

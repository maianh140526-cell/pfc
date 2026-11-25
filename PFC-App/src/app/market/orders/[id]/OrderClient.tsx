"use client";

import { Star } from "lucide-react";
import { useState } from "react";
import type { OrderAction, PaymentMethod } from "@/modules/market/domain/orders";
import { orderActionAction, payOrderAction, reviewItemAction } from "@/modules/market/server/actions";
import { BottomSheet, Button } from "@/ui";
import { ConfirmSheet } from "@/ui/ConfirmSheet";
import { FormError, TextArea } from "@/ui/Form";
import { useAction } from "@/ui/use-action";

const LABEL: Record<OrderAction, string> = {
  confirm: "Xác nhận đơn",
  mark_paid: "Đã nhận tiền",
  ship: "Bắt đầu giao",
  deliver: "Đã giao xong",
  complete: "Đã nhận hàng",
  cancel: "Hủy đơn",
};

export function OrderActions({ orderId, actions, role, paymentMethod }: { orderId: string; actions: OrderAction[]; role: "buyer" | "seller"; paymentMethod: PaymentMethod }) {
  const a = useAction();
  const [cancelOpen, setCancelOpen] = useState(false);
  const [reason, setReason] = useState("");
  const primary = actions.filter((x) => x !== "cancel");
  return (
    <>
      <div className="grid gap-2">
        {primary.map((x) => (
          <Button key={x} block disabled={a.pending} variant={x === "mark_paid" ? "secondary" : "primary"} onClick={() => a.run(() => orderActionAction(orderId, x))}>
            {LABEL[x]}
          </Button>
        ))}
        {actions.includes("cancel") && (
          <Button block variant="ghost" className="text-expense" onClick={() => setCancelOpen(true)}>
            Hủy đơn
          </Button>
        )}
      </div>
      {role === "seller" && paymentMethod === "bank_transfer" && actions.includes("mark_paid") && (
        <p className="mt-2 text-[12px] text-muted">Đơn chuyển khoản: chỉ bấm “Đã nhận tiền” khi tiền đã vào tài khoản của bạn.</p>
      )}
      <div className="mt-2">
        <FormError message={a.error} />
      </div>
      {role === "seller" ? (
        <BottomSheet
          open={cancelOpen}
          onClose={() => setCancelOpen(false)}
          title="Hủy đơn hàng"
          footer={
            <Button variant="danger" block disabled={a.pending || !reason.trim()} onClick={() => a.run(() => orderActionAction(orderId, "cancel", reason), () => setCancelOpen(false))}>
              Hủy đơn
            </Button>
          }
        >
          <TextArea label="Lý do (người mua sẽ thấy)" value={reason} onChange={(e) => setReason(e.target.value)} maxLength={300} />
        </BottomSheet>
      ) : (
        <ConfirmSheet
          open={cancelOpen}
          onClose={() => setCancelOpen(false)}
          title="Hủy đơn hàng?"
          message="Đơn sẽ bị hủy và sản phẩm được trả lại kho của người bán."
          confirmLabel="Hủy đơn"
          pending={a.pending}
          onConfirm={() => a.run(() => orderActionAction(orderId, "cancel"), () => setCancelOpen(false))}
        />
      )}
    </>
  );
}

/** MKT-19 Write Review (mockup 67): only shown for completed orders. */
export function ReviewButton({ orderId, listingId, title }: { orderId: string; listingId: string; title: string }) {
  const [open, setOpen] = useState(false);
  const [rating, setRating] = useState(5);
  const [comment, setComment] = useState("");
  const a = useAction();
  return (
    <>
      <button type="button" onClick={() => setOpen(true)} className="shrink-0 rounded-full border border-primary px-3 py-1.5 text-[13px] font-semibold text-primary">
        Đánh giá
      </button>
      <BottomSheet
        open={open}
        onClose={() => setOpen(false)}
        title="Viết đánh giá"
        footer={
          <Button block disabled={a.pending} onClick={() => a.run(() => reviewItemAction(orderId, listingId, { rating, comment }), () => setOpen(false))}>
            Gửi đánh giá
          </Button>
        }
      >
        <p className="text-[15px] font-semibold text-ink">{title}</p>
        <div className="my-4 flex justify-center gap-2" role="radiogroup" aria-label="Số sao">
          {[1, 2, 3, 4, 5].map((n) => (
            <button key={n} type="button" role="radio" aria-checked={rating === n} aria-label={`${n} sao`} onClick={() => setRating(n)} className="text-warning">
              <Star size={36} className={n <= rating ? "fill-warning" : "text-line"} />
            </button>
          ))}
        </div>
        <TextArea label="Chia sẻ trải nghiệm (không bắt buộc)" value={comment} onChange={(e) => setComment(e.target.value)} maxLength={1000} />
        <div className="mt-2">
          <FormError message={a.error} />
        </div>
      </BottomSheet>
    </>
  );
}

/** VNPAY order not paid yet: open a new payment (the previous one may have been closed or expired). */
export function PayOrderButton({ orderId }: { orderId: string }) {
  const a = useAction();
  return (
    <div className="space-y-2">
      <Button block disabled={a.pending} onClick={() => a.run(() => payOrderAction(orderId), (url) => (window.location.href = url))}>
        {a.pending ? "Đang chuyển tới VNPAY…" : "Thanh toán qua VNPAY"}
      </Button>
      <FormError message={a.error} />
    </div>
  );
}

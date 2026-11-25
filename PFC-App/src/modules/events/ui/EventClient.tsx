"use client";

import { Heart } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button } from "@/ui";
import { FormError, TextArea } from "@/ui/Form";
import { useAction } from "@/ui/use-action";
import type { EventAction } from "../domain/events";
import { cancelRegistrationAction, eventTransitionAction, resumePaymentAction, toggleFavoriteAction } from "../server/actions";

export function FavoriteButton({ id, initial }: { id: string; initial: boolean }) {
  const a = useAction();
  const [on, setOn] = useState(initial);
  return (
    <button
      type="button"
      aria-pressed={on}
      aria-label={on ? "Bỏ lưu sự kiện" : "Lưu sự kiện"}
      disabled={a.pending}
      onClick={() => {
        setOn(!on);
        a.run(() => toggleFavoriteAction(id), (v) => setOn(v));
      }}
      className="grid size-11 place-items-center rounded-full text-ink active:bg-surface-2"
    >
      <Heart size={22} className={on ? "fill-expense text-expense" : ""} />
    </button>
  );
}

const LABEL: Record<EventAction, string> = { submit: "Gửi duyệt", approve: "Duyệt & mở đăng ký", reject: "Từ chối", cancel: "Hủy sự kiện" };

/** Organizer / approver actions. Reject and cancel need a reason that the other side sees. */
export function EventActions({ id, actions, approverPublishes }: { id: string; actions: EventAction[]; approverPublishes: boolean }) {
  const a = useAction();
  const [ask, setAsk] = useState<EventAction | null>(null);
  const [reason, setReason] = useState("");
  if (!actions.length) return null;
  return (
    <div className="space-y-2">
      {ask ? (
        <>
          <TextArea
            label={ask === "cancel" ? "Lý do hủy (người đăng ký sẽ nhận được)" : "Lý do từ chối (để người tổ chức sửa)"}
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            maxLength={300}
          />
          <div className="grid grid-cols-2 gap-2">
            <Button variant="secondary" onClick={() => setAsk(null)}>
              Thôi
            </Button>
            <Button variant="danger" disabled={a.pending || !reason.trim()} onClick={() => a.run(() => eventTransitionAction(id, ask, reason), () => setAsk(null))}>
              {LABEL[ask]}
            </Button>
          </div>
          {ask === "cancel" && <p className="text-[12px] text-muted">Vé đã thanh toán trực tuyến sẽ được hoàn tiền tự động.</p>}
        </>
      ) : (
        <div className="flex flex-wrap gap-2">
          {actions.map((x) =>
            x === "reject" || x === "cancel" ? (
              <Button key={x} variant={x === "cancel" ? "ghost" : "secondary"} onClick={() => setAsk(x)}>
                {LABEL[x]}
              </Button>
            ) : (
              <Button key={x} disabled={a.pending} onClick={() => a.run(() => eventTransitionAction(id, x))}>
                {x === "submit" && approverPublishes ? "Công bố" : LABEL[x]}
              </Button>
            ),
          )}
        </div>
      )}
      <FormError message={a.error} />
    </div>
  );
}

/** Held seat: continue to VNPAY. Free / pay-at-door: cancel. */
export function TicketActions({ registrationId, status, canCancel, payPending }: { registrationId: string; status: string; canCancel: boolean; payPending: boolean }) {
  const a = useAction();
  const router = useRouter();
  const [confirm, setConfirm] = useState(false);
  return (
    <div className="space-y-2">
      {payPending && status === "pending_payment" && (
        <Button block disabled={a.pending} onClick={() => a.run(() => resumePaymentAction(registrationId), (url) => (window.location.href = url))}>
          {a.pending ? "Đang chuyển tới VNPAY…" : "Tiếp tục thanh toán"}
        </Button>
      )}
      {canCancel &&
        (confirm ? (
          <div className="grid grid-cols-2 gap-2">
            <Button variant="secondary" onClick={() => setConfirm(false)}>
              Giữ vé
            </Button>
            <Button variant="danger" disabled={a.pending} onClick={() => a.run(() => cancelRegistrationAction(registrationId), () => router.refresh())}>
              Hủy đăng ký
            </Button>
          </div>
        ) : (
          <Button block variant="ghost" onClick={() => setConfirm(true)}>
            {status === "pending_payment" ? "Bỏ giữ chỗ" : "Hủy đăng ký"}
          </Button>
        ))}
      <FormError message={a.error} />
    </div>
  );
}

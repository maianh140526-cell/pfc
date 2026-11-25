"use client";

import { useState } from "react";
import { decideVerificationAction } from "@/modules/market/server/actions";
import { Button, Card } from "@/ui";
import { FormError, TextArea } from "@/ui/Form";
import { useAction } from "@/ui/use-action";

/** ADM-15 Seller verification request (real name + phone + what they plan to sell). */
export function VerifyDecision({ s }: { s: { memberId: string; shopName: string; memberName: string; legalName: string; phone: string; note: string } }) {
  const a = useAction();
  const [rejecting, setRejecting] = useState(false);
  const [reason, setReason] = useState("");
  return (
    <Card className="p-3.5">
      <p className="text-[15px] font-bold text-ink">{s.shopName}</p>
      <p className="text-[12px] text-muted">
        Tài khoản: {s.memberName} · Họ tên thật: <b className="text-ink-2">{s.legalName}</b> · {s.phone}
      </p>
      <p className="mt-1 text-[13px] text-ink-2">{s.note}</p>
      {rejecting ? (
        <div className="mt-3 space-y-2">
          <TextArea label="Lý do từ chối (người bán sẽ thấy)" value={reason} onChange={(e) => setReason(e.target.value)} maxLength={300} />
          <div className="flex gap-2">
            <Button variant="secondary" className="flex-1" onClick={() => setRejecting(false)}>
              Thôi
            </Button>
            <Button variant="danger" className="flex-1" disabled={a.pending || !reason.trim()} onClick={() => a.run(() => decideVerificationAction(s.memberId, false, reason))}>
              Từ chối
            </Button>
          </div>
        </div>
      ) : (
        <div className="mt-3 flex gap-2">
          <Button variant="secondary" className="min-h-10 flex-1 text-[14px]" onClick={() => setRejecting(true)}>
            Từ chối
          </Button>
          <Button className="min-h-10 flex-1 text-[14px]" disabled={a.pending} onClick={() => a.run(() => decideVerificationAction(s.memberId, true))}>
            Xác minh
          </Button>
        </div>
      )}
      <FormError message={a.error} />
    </Card>
  );
}

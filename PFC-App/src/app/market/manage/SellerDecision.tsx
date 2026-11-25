"use client";

import { useState } from "react";
import { decideSellerAction } from "@/modules/market/server/actions";
import { BottomSheet, Button, Card } from "@/ui";
import { FormError, TextArea } from "@/ui/Form";
import { useAction } from "@/ui/use-action";

export function SellerDecision({ seller, mode }: { seller: { memberId: string; shopName: string; memberName: string; bio: string; contact: string }; mode: "pending" | "active" }) {
  const a = useAction();
  const [reasonFor, setReasonFor] = useState<"reject" | "suspend" | null>(null);
  const [reason, setReason] = useState("");
  return (
    <Card className="p-3.5">
      <p className="text-[15px] font-bold text-ink">{seller.shopName}</p>
      <p className="text-[12px] text-muted">
        {seller.memberName} · {seller.contact}
      </p>
      {seller.bio && <p className="mt-1 text-[13px] text-ink-2">{seller.bio}</p>}
      <div className="mt-3 flex gap-2">
        {mode === "pending" ? (
          <>
            <Button variant="secondary" className="min-h-10 flex-1 text-[14px]" disabled={a.pending} onClick={() => setReasonFor("reject")}>
              Từ chối
            </Button>
            <Button className="min-h-10 flex-1 text-[14px]" disabled={a.pending} onClick={() => a.run(() => decideSellerAction(seller.memberId, "approve"))}>
              Duyệt
            </Button>
          </>
        ) : (
          <Button variant="ghost" className="min-h-10 flex-1 text-[14px] text-expense" disabled={a.pending} onClick={() => setReasonFor("suspend")}>
            Tạm ngưng cửa hàng
          </Button>
        )}
      </div>
      <FormError message={a.error} />
      <BottomSheet
        open={reasonFor !== null}
        onClose={() => setReasonFor(null)}
        title={reasonFor === "reject" ? "Từ chối người bán" : "Tạm ngưng cửa hàng"}
        footer={
          <Button variant="danger" block disabled={a.pending || !reason.trim()} onClick={() => reasonFor && a.run(() => decideSellerAction(seller.memberId, reasonFor, reason), () => setReasonFor(null))}>
            Xác nhận
          </Button>
        }
      >
        <TextArea label="Lý do (người bán sẽ thấy)" value={reason} onChange={(e) => setReason(e.target.value)} maxLength={300} />
        {reasonFor === "suspend" && <p className="mt-2 text-[12px] text-muted">Mọi tin đang bán của cửa hàng sẽ bị gỡ xuống.</p>}
      </BottomSheet>
    </Card>
  );
}

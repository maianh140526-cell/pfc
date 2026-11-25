"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button } from "@/ui";
import { FormError, SelectInput, TextArea, TextInput } from "@/ui/Form";
import { useAction } from "@/ui/use-action";
import { createPayoutAction, decideRefundAction, markPayoutPaidAction, markRefundedAction, requestRefundAction } from "../server/actions";

/** PAY-08 Refund request (mockup 68). */
export function RefundRequestForm({ refType, refId, reasons, backHref }: { refType: string; refId: string; reasons: [string, string][]; backHref: string }) {
  const router = useRouter();
  const a = useAction();
  const [reason, setReason] = useState(reasons[0][0]);
  const [details, setDetails] = useState("");
  return (
    <form
      className="space-y-4 px-4 pb-6"
      noValidate
      onSubmit={(e) => {
        e.preventDefault();
        a.run(() => requestRefundAction({ refType, refId, reason, details }), (id) => router.replace(`/payments/refunds/${id}`));
      }}
    >
      <SelectInput label="Lý do" value={reason} onChange={(e) => setReason(e.target.value)}>
        {reasons.map(([k, l]) => (
          <option key={k} value={k}>
            {l}
          </option>
        ))}
      </SelectInput>
      <TextArea label="Mô tả thêm" hint="Ít nhất 10 ký tự" value={details} onChange={(e) => setDetails(e.target.value)} maxLength={500} />
      <FormError message={a.error} />
      <Button type="submit" block disabled={a.pending}>
        {a.pending ? "Đang gửi…" : "Gửi yêu cầu hoàn tiền"}
      </Button>
      <Button variant="ghost" block onClick={() => router.replace(backHref)}>
        Quay lại
      </Button>
    </form>
  );
}

/** Payee / Chủ nhiệm decision on a refund request (mockup 69). */
export function RefundDecision({ id }: { id: string }) {
  const a = useAction();
  const [rejecting, setRejecting] = useState(false);
  const [note, setNote] = useState("");
  return (
    <div className="space-y-2">
      {rejecting ? (
        <>
          <TextArea label="Lý do từ chối (người yêu cầu sẽ thấy)" value={note} onChange={(e) => setNote(e.target.value)} maxLength={300} />
          <div className="grid grid-cols-2 gap-2">
            <Button variant="secondary" onClick={() => setRejecting(false)}>
              Thôi
            </Button>
            <Button variant="danger" disabled={a.pending || !note.trim()} onClick={() => a.run(() => decideRefundAction(id, false, note))}>
              Từ chối
            </Button>
          </div>
        </>
      ) : (
        <div className="grid grid-cols-2 gap-2">
          <Button variant="secondary" onClick={() => setRejecting(true)}>
            Từ chối
          </Button>
          <Button disabled={a.pending} onClick={() => a.run(() => decideRefundAction(id, true))}>
            {a.pending ? "Đang xử lý…" : "Đồng ý hoàn tiền"}
          </Button>
        </div>
      )}
      <FormError message={a.error} />
    </div>
  );
}

/** Staff record a refund done by bank transfer when the VNPAY refund API was not available. */
export function MarkRefunded({ id }: { id: string }) {
  const a = useAction();
  const [ref, setRef] = useState("");
  return (
    <form
      className="space-y-2"
      onSubmit={(e) => {
        e.preventDefault();
        a.run(() => markRefundedAction(id, ref), () => setRef(""));
      }}
    >
      <TextInput label="Mã tham chiếu chuyển khoản hoàn tiền" value={ref} onChange={(e) => setRef(e.target.value)} maxLength={100} />
      <FormError message={a.error} />
      <Button type="submit" block disabled={a.pending || ref.trim().length < 3}>
        Xác nhận đã hoàn tiền
      </Button>
    </form>
  );
}

export function CreatePayoutButton({ payeeId }: { payeeId: string }) {
  const a = useAction();
  return (
    <>
      <Button variant="secondary" disabled={a.pending} onClick={() => a.run(() => createPayoutAction(payeeId))}>
        Tạo lệnh chi
      </Button>
      <FormError message={a.error} />
    </>
  );
}

export function MarkPayoutPaid({ id }: { id: string }) {
  const a = useAction();
  const [note, setNote] = useState("");
  return (
    <form
      className="mt-2 flex items-end gap-2"
      onSubmit={(e) => {
        e.preventDefault();
        a.run(() => markPayoutPaidAction(id, note), () => setNote(""));
      }}
    >
      <div className="flex-1">
        <TextInput label="Nội dung / mã chuyển khoản" value={note} onChange={(e) => setNote(e.target.value)} maxLength={200} />
      </div>
      <Button type="submit" disabled={a.pending || note.trim().length < 3}>
        Đã chi
      </Button>
      <FormError message={a.error} />
    </form>
  );
}

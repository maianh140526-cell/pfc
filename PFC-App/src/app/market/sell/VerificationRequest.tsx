"use client";

import { useState } from "react";
import { requestVerificationAction } from "@/modules/market/server/actions";
import { Button } from "@/ui";
import { FormError, TextArea, TextInput } from "@/ui/Form";
import { useAction } from "@/ui/use-action";

/** SELL-03 Request the "verified" level (real name + phone, reviewed by staff). */
export function VerificationRequest() {
  const a = useAction();
  const [v, setV] = useState({ legalName: "", phone: "", note: "" });
  const [sent, setSent] = useState(false);
  if (sent) return <p className="rounded-xl bg-income-soft px-4 py-3 text-[14px] text-income">Đã gửi yêu cầu xác minh. Ban điều hành sẽ phản hồi qua thông báo.</p>;
  return (
    <form
      className="space-y-3"
      noValidate
      onSubmit={(e) => {
        e.preventDefault();
        a.run(() => requestVerificationAction(v), () => setSent(true));
      }}
    >
      <TextInput label="Họ tên thật" value={v.legalName} onChange={(e) => setV({ ...v, legalName: e.target.value })} maxLength={80} autoComplete="name" />
      <TextInput label="Số điện thoại" type="tel" value={v.phone} onChange={(e) => setV({ ...v, phone: e.target.value })} autoComplete="tel" hint="Chỉ Ban điều hành thấy, dùng khi có khiếu nại." />
      <TextArea label="Bạn định bán gì?" value={v.note} onChange={(e) => setV({ ...v, note: e.target.value })} maxLength={500} placeholder="VD: dịch vụ review CV, khóa học Excel tài chính, vé workshop…" />
      <FormError message={a.error} />
      <Button type="submit" block disabled={a.pending}>
        {a.pending ? "Đang gửi…" : "Gửi yêu cầu xác minh"}
      </Button>
    </form>
  );
}

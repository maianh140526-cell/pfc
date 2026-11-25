"use client";

import { useState } from "react";
import { registerSellerAction } from "@/modules/market/server/actions";
import { Button, Section } from "@/ui";
import { FormError, TextArea, TextInput } from "@/ui/Form";
import { useAction } from "@/ui/use-action";

/** SELL-02 Seller Registration (Q04 risk-based verification: basic shop at once, "verified" level reviewed by staff). */
export function SellerRegistration({ initial, submitLabel = "Mở cửa hàng" }: { initial?: { shopName: string; bio: string; contact: string }; submitLabel?: string }) {
  const [v, setV] = useState(initial ?? { shopName: "", bio: "", contact: "" });
  const { run, pending, error } = useAction();
  const [saved, setSaved] = useState(false);
  return (
    <Section title={initial ? "Hồ sơ cửa hàng" : "Mở cửa hàng trên PFC"}>
      {!initial && <p className="mb-3 text-[14px] text-ink-2">Bán sách cũ, tài liệu, dịch vụ hay khóa học của bạn cho cộng đồng PFC. Tài khoản đã xác thực email mở cửa hàng ngay để bán sản phẩm vật lý và sản phẩm số; dịch vụ, khóa học, vé sự kiện cần xác minh thêm. Mỗi tin đăng được duyệt trước khi hiện công khai.</p>}
      <form
        className="space-y-4"
        noValidate
        onSubmit={(e) => {
          e.preventDefault();
          setSaved(false);
          run(() => registerSellerAction(v), () => setSaved(true));
        }}
      >
        <TextInput label="Tên cửa hàng" value={v.shopName} onChange={(e) => setV({ ...v, shopName: e.target.value })} maxLength={60} />
        <TextArea label="Giới thiệu" value={v.bio} onChange={(e) => setV({ ...v, bio: e.target.value })} maxLength={500} />
        <TextInput label="Liên hệ (Zalo / điện thoại / email)" value={v.contact} onChange={(e) => setV({ ...v, contact: e.target.value })} maxLength={120} hint="Chỉ người mua đã đặt hàng mới thấy thông tin này." />
        <FormError message={error} />
        {error?.includes("Xác thực email") && (
          <a href="/verify-email" className="block text-[14px] font-semibold text-primary underline">
            Xác thực email ngay
          </a>
        )}
        {saved && <p className="text-[14px] font-semibold text-income">Đã lưu.</p>}
        <Button type="submit" block disabled={pending}>
          {pending ? "Đang gửi…" : submitLabel}
        </Button>
      </form>
    </Section>
  );
}

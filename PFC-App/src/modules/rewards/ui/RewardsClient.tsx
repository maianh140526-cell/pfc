"use client";

import { Check, Copy, Share2 } from "lucide-react";
import { useState } from "react";
import { Button } from "@/ui";
import { ConfirmSheet } from "@/ui/ConfirmSheet";
import { FormError } from "@/ui/Form";
import { useAction } from "@/ui/use-action";
import { redeemAction } from "../server/actions";

export function ReferralShare({ url }: { url: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <div className="flex gap-2">
      <Button
        variant="secondary"
        className="flex-1"
        onClick={async () => {
          try {
            await navigator.clipboard.writeText(url);
            setCopied(true);
            setTimeout(() => setCopied(false), 2000);
          } catch {
            /* clipboard blocked: the link is shown on screen */
          }
        }}
      >
        {copied ? <Check size={18} /> : <Copy size={18} />} {copied ? "Đã chép" : "Chép link"}
      </Button>
      {typeof navigator !== "undefined" && "share" in navigator && (
        <Button className="flex-1" onClick={() => navigator.share({ title: "Tham gia PFC", text: "Mời bạn tham gia cộng đồng tài chính PFC", url }).catch(() => {})}>
          <Share2 size={18} /> Chia sẻ
        </Button>
      )}
    </div>
  );
}

export function RedeemButton({ id, title, cost, disabled, reason }: { id: string; title: string; cost: number; disabled: boolean; reason?: string }) {
  const a = useAction();
  const [open, setOpen] = useState(false);
  const [done, setDone] = useState(false);
  return (
    <>
      <Button variant={disabled ? "secondary" : "primary"} disabled={disabled || a.pending || done} onClick={() => setOpen(true)}>
        {done ? "Đã gửi yêu cầu" : reason ?? "Đổi quà"}
      </Button>
      <FormError message={a.error} />
      <ConfirmSheet
        open={open}
        onClose={() => setOpen(false)}
        title={`Đổi “${title}”?`}
        message={`Trừ ${cost.toLocaleString("vi-VN")} điểm. Ban điều hành sẽ liên hệ trao quà; nếu yêu cầu bị hủy, điểm được hoàn lại.`}
        confirmLabel="Đổi quà"
        danger={false}
        pending={a.pending}
        onConfirm={() =>
          a.run(
            () => redeemAction(id),
            () => {
              setOpen(false);
              setDone(true);
            },
          )
        }
      />
    </>
  );
}

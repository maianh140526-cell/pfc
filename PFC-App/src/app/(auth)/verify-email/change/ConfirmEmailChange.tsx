"use client";

import { CheckCircle2, Loader2, MailCheck, MailX } from "lucide-react";
import { useState, useTransition } from "react";
import { confirmEmailChangeAction } from "@/platform/account/actions";
import { Button, ButtonLink } from "@/ui";

export function ConfirmEmailChange({ token }: { token: string }) {
  const [state, setState] = useState<"idle" | "done" | { error: string }>(token ? "idle" : { error: "Liên kết không hợp lệ." });
  const [pending, start] = useTransition();
  const box = (icon: React.ReactNode, tone: string, title: string, body: React.ReactNode) => (
    <div className="mx-auto flex w-full max-w-sm flex-1 flex-col items-center pt-12 text-center">
      <span className={`grid size-16 place-items-center rounded-full ${tone}`}>{icon}</span>
      <h1 className="mt-4 text-[22px] font-extrabold text-ink">{title}</h1>
      <div className="mt-6 w-full">{body}</div>
    </div>
  );
  if (state === "done") {
    return box(<CheckCircle2 size={30} />, "bg-income-soft text-income", "Đã đổi email", <ButtonLink href="/more/account" block>Về cài đặt tài khoản</ButtonLink>);
  }
  if (typeof state === "object") {
    return box(<MailX size={30} />, "bg-expense-soft text-expense", state.error, <ButtonLink href="/more/account/profile" block>Yêu cầu lại</ButtonLink>);
  }
  return box(
    <MailCheck size={30} />,
    "bg-primary-soft text-primary",
    "Dùng email này cho tài khoản PFC?",
    <Button
      block
      disabled={pending}
      onClick={() =>
        start(async () => {
          const r = await confirmEmailChangeAction(token).catch(() => ({ ok: false as const, error: "Không kết nối được máy chủ." }));
          setState(r.ok ? "done" : { error: r.error });
        })
      }
    >
      {pending ? (
        <>
          <Loader2 size={18} className="animate-spin" /> Đang xác nhận…
        </>
      ) : (
        "Xác nhận email mới"
      )}
    </Button>,
  );
}

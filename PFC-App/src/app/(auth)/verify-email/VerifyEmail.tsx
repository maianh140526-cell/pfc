"use client";

import Link from "next/link";
import { CheckCircle2, Loader2, MailCheck, MailX } from "lucide-react";
import { useState, useTransition } from "react";
import { verifyEmailAction } from "@/platform/auth/actions";
import { Button, ButtonLink } from "@/ui";

export function VerifyEmail({ token }: { token: string }) {
  const [state, setState] = useState<"idle" | "done" | { error: string }>("idle");
  const [pending, start] = useTransition();

  if (state === "done") {
    return (
      <Shell icon={<CheckCircle2 size={30} />} tone="bg-income-soft text-income" title="Email đã được xác thực" text="Cảm ơn bạn! Tài khoản PFC đã sẵn sàng.">
        <ButtonLink href="/login?verified=1" block>
          Đăng nhập
        </ButtonLink>
      </Shell>
    );
  }
  if (!token || typeof state === "object") {
    return (
      <Shell
        icon={<MailX size={30} />}
        tone="bg-expense-soft text-expense"
        title={typeof state === "object" ? state.error : "Liên kết không hợp lệ."}
        text="Đăng nhập để gửi lại thư xác thực mới."
      >
        <ButtonLink href="/login" block>
          Về đăng nhập
        </ButtonLink>
      </Shell>
    );
  }
  return (
    <Shell icon={<MailCheck size={30} />} tone="bg-primary-soft text-primary" title="Xác thực email" text="Bấm nút bên dưới để xác nhận đây là email của bạn.">
      <Button
        block
        disabled={pending}
        onClick={() =>
          start(async () => {
            const r = await verifyEmailAction(token).catch(() => ({ ok: false as const, error: "Không kết nối được máy chủ. Thử lại." }));
            setState(r.ok ? "done" : { error: r.error });
          })
        }
      >
        {pending ? (
          <>
            <Loader2 size={18} className="animate-spin" /> Đang xác thực…
          </>
        ) : (
          "Xác nhận email"
        )}
      </Button>
    </Shell>
  );
}

function Shell({ icon, tone, title, text, children }: { icon: React.ReactNode; tone: string; title: string; text: string; children: React.ReactNode }) {
  return (
    <div className="mx-auto flex w-full max-w-sm flex-1 flex-col items-center pt-12 text-center">
      <span className={`grid size-16 place-items-center rounded-full ${tone}`}>{icon}</span>
      <h1 className="mt-4 text-[22px] font-extrabold text-ink">{title}</h1>
      <p className="mt-1 mb-6 text-[15px] text-muted">{text}</p>
      {children}
      <Link href="/home" className="mt-4 text-[14px] font-semibold text-primary">
        Về trang chủ PFC
      </Link>
    </div>
  );
}

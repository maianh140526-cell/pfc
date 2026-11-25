"use client";

import Link from "next/link";
import { ArrowLeft, KeyRound, Loader2, MailCheck } from "lucide-react";
import { useState, useTransition } from "react";
import { forgotPasswordAction } from "@/platform/auth/actions";
import { Button } from "@/ui";
import { FormError, TextInput } from "@/ui/Form";

export function ForgotForm({ initialEmail }: { initialEmail: string }) {
  const [email, setEmail] = useState(initialEmail);
  const [error, setError] = useState<string | null>(null);
  const [sent, setSent] = useState(false);
  const [pending, start] = useTransition();

  function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!email.trim()) return setError("Vui lòng nhập email.");
    setError(null);
    start(async () => {
      const r = await forgotPasswordAction(email).catch(() => ({ ok: false as const, error: "Không kết nối được máy chủ. Kiểm tra mạng và thử lại." }));
      if (r.ok) setSent(true);
      else setError(r.error);
    });
  }

  return (
    <div className="mx-auto flex w-full max-w-sm flex-1 flex-col">
      <Link href="/login" className="-ml-2 mb-4 flex min-h-11 w-fit items-center gap-1 px-2 text-[15px] font-semibold text-ink-2">
        <ArrowLeft size={20} /> Đăng nhập
      </Link>
      {sent ? (
        <div className="space-y-3 pt-6 text-center">
          <MailCheck size={48} className="mx-auto text-primary" />
          <h1 className="text-[24px] font-extrabold text-ink">Kiểm tra email</h1>
          <p className="text-[15px] text-ink-2">
            Nếu <b>{email.trim().toLowerCase()}</b> có tài khoản PFC, chúng tôi đã gửi liên kết đặt lại mật khẩu. Liên kết có hiệu lực 30 phút và chỉ dùng được một lần.
          </p>
          <p className="text-[13px] text-muted">Không thấy thư? Kiểm tra mục Spam, hoặc thử lại sau vài phút.</p>
          <Button variant="secondary" block onClick={() => setSent(false)}>
            Gửi lại
          </Button>
        </div>
      ) : (
        <>
          <span className="mx-auto mt-4 grid size-16 place-items-center rounded-full bg-primary-soft text-primary">
            <KeyRound size={30} />
          </span>
          <h1 className="mt-4 text-center text-[24px] font-extrabold text-ink">Quên mật khẩu?</h1>
          <p className="mt-1 mb-6 text-center text-[15px] text-muted">Nhập email tài khoản PFC. Chúng tôi sẽ gửi liên kết để đặt mật khẩu mới.</p>
          <form onSubmit={submit} className="space-y-4" noValidate aria-busy={pending}>
            <TextInput
              label="Email"
              type="email"
              inputMode="email"
              autoComplete="email"
              autoCapitalize="none"
              value={email}
              disabled={pending}
              onChange={(e) => setEmail(e.target.value)}
            />
            <FormError message={error} />
            <Button type="submit" block disabled={pending}>
              {pending ? (
                <>
                  <Loader2 size={18} className="animate-spin" /> Đang gửi…
                </>
              ) : (
                "Gửi liên kết đặt lại"
              )}
            </Button>
          </form>
        </>
      )}
    </div>
  );
}

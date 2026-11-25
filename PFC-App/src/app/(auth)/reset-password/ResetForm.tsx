"use client";

import { Check, Circle, Loader2, ShieldCheck } from "lucide-react";
import { useState, useTransition } from "react";
import { resetPasswordAction } from "@/platform/auth/actions";
import { PASSWORD_RULES } from "@/platform/auth/password-policy";
import { Button } from "@/ui";
import { FormError, PasswordInput } from "@/ui/Form";
import { cx } from "@/ui/cx";

export function ResetForm({ token }: { token: string }) {
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();

  function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    start(async () => {
      try {
        const r = await resetPasswordAction({ token, password, confirm });
        if (r && !r.ok) setError(r.error);
      } catch (err) {
        if (err && typeof err === "object" && "digest" in err) throw err;
        setError("Không kết nối được máy chủ. Kiểm tra mạng và thử lại.");
      }
    });
  }

  return (
    <div className="mx-auto flex w-full max-w-sm flex-1 flex-col">
      <span className="mx-auto mt-6 grid size-16 place-items-center rounded-full bg-primary-soft text-primary">
        <ShieldCheck size={30} />
      </span>
      <h1 className="mt-4 text-center text-[24px] font-extrabold text-ink">Đặt mật khẩu mới</h1>
      <p className="mt-1 mb-6 text-center text-[15px] text-muted">Sau khi đổi, mọi thiết bị đang đăng nhập sẽ được đăng xuất.</p>
      <form onSubmit={submit} className="space-y-4" noValidate aria-busy={pending}>
        <fieldset disabled={pending} className="space-y-4">
          <PasswordInput label="Mật khẩu mới" autoComplete="new-password" value={password} onChange={(e) => setPassword(e.target.value)} />
          <ul className="space-y-1 text-[13px]">
            {PASSWORD_RULES.map((r) => {
              const ok = r.test(password);
              return (
                <li key={r.id} className={cx("flex items-center gap-2", ok ? "text-income" : "text-muted")}>
                  {ok ? <Check size={15} /> : <Circle size={15} />} {r.label}
                </li>
              );
            })}
          </ul>
          <PasswordInput
            label="Nhập lại mật khẩu mới"
            autoComplete="new-password"
            value={confirm}
            error={confirm && confirm !== password ? "Mật khẩu xác nhận không khớp." : null}
            onChange={(e) => setConfirm(e.target.value)}
          />
        </fieldset>
        <FormError message={error} />
        <Button type="submit" block disabled={pending}>
          {pending ? (
            <>
              <Loader2 size={18} className="animate-spin" /> Đang lưu…
            </>
          ) : (
            "Đặt mật khẩu mới"
          )}
        </Button>
      </form>
    </div>
  );
}

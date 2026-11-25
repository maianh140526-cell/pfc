"use client";

import { CheckCircle2 } from "lucide-react";
import { useState } from "react";
import { changePasswordAction } from "@/platform/auth/actions";
import { Button } from "@/ui";
import { FormError, PasswordInput } from "@/ui/Form";
import { useAction } from "@/ui/use-action";

export function PasswordForm() {
  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const [confirm, setConfirm] = useState("");
  const [done, setDone] = useState(false);
  const { run, pending, error } = useAction();

  if (done) {
    return (
      <div className="flex flex-col items-center px-6 pt-10 text-center">
        <CheckCircle2 size={52} className="text-income" />
        <p className="mt-3 text-[18px] font-bold text-ink">Đã đổi mật khẩu</p>
        <p className="mt-1 text-[14px] text-muted">Dùng mật khẩu mới cho lần đăng nhập sau.</p>
      </div>
    );
  }

  return (
    <form
      className="space-y-4 px-4 pt-2"
      noValidate
      onSubmit={(e) => {
        e.preventDefault();
        run(() => changePasswordAction({ current, next, confirm }), () => setDone(true));
      }}
    >
      <PasswordInput label="Mật khẩu hiện tại" autoComplete="current-password" value={current} onChange={(e) => setCurrent(e.target.value)} />
      <PasswordInput
        label="Mật khẩu mới"
        autoComplete="new-password"
        hint="Ít nhất 8 ký tự, gồm chữ và số."
        value={next}
        onChange={(e) => setNext(e.target.value)}
      />
      <PasswordInput label="Xác nhận mật khẩu mới" autoComplete="new-password" value={confirm} onChange={(e) => setConfirm(e.target.value)} />
      <FormError message={error} />
      <Button type="submit" block disabled={pending}>
        {pending ? "Đang lưu…" : "Đổi mật khẩu"}
      </Button>
    </form>
  );
}

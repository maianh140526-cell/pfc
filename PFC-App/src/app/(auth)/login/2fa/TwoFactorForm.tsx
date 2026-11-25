"use client";

import Link from "next/link";
import { Loader2, ShieldCheck } from "lucide-react";
import { useState, useTransition } from "react";
import { verifyTwoFactorAction } from "@/platform/auth/actions";
import { Button } from "@/ui";
import { FormError, TextInput } from "@/ui/Form";

export function TwoFactorForm() {
  const [code, setCode] = useState("");
  const [backup, setBackup] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const valid = backup ? code.replace(/[^0-9a-z]/gi, "").length === 8 : code.replace(/\s/g, "").length === 6;

  function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    start(async () => {
      try {
        const r = await verifyTwoFactorAction(code);
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
      <h1 className="mt-4 text-center text-[24px] font-extrabold text-ink">Xác thực hai lớp</h1>
      <p className="mt-1 mb-6 text-center text-[15px] text-muted">
        {backup ? "Nhập một mã dự phòng (mỗi mã dùng một lần)." : "Nhập mã 6 số trong ứng dụng xác thực trên điện thoại."}
      </p>
      <form onSubmit={submit} className="space-y-4" noValidate aria-busy={pending}>
        <TextInput
          label={backup ? "Mã dự phòng" : "Mã xác thực"}
          inputMode={backup ? "text" : "numeric"}
          autoComplete="one-time-code"
          autoCapitalize="characters"
          autoFocus
          maxLength={backup ? 9 : 7}
          placeholder={backup ? "ABCD-EFGH" : "123456"}
          className="text-center text-[22px] tracking-[0.3em]"
          value={code}
          onChange={(e) => setCode(e.target.value)}
        />
        <FormError message={error} />
        <Button type="submit" block disabled={pending || !valid}>
          {pending ? (
            <>
              <Loader2 size={18} className="animate-spin" /> Đang kiểm tra…
            </>
          ) : (
            "Xác nhận"
          )}
        </Button>
      </form>
      <button
        type="button"
        className="mt-4 min-h-11 text-[14px] font-semibold text-primary"
        onClick={() => {
          setBackup((b) => !b);
          setCode("");
          setError(null);
        }}
      >
        {backup ? "Dùng mã từ ứng dụng" : "Mất điện thoại? Dùng mã dự phòng"}
      </button>
      <Link href="/login" className="mt-auto pt-8 text-center text-[14px] text-muted">
        Quay lại đăng nhập
      </Link>
    </div>
  );
}

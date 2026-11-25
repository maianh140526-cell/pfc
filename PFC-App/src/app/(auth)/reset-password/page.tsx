import Link from "next/link";
import { LinkIcon } from "lucide-react";
import { resetTokenStatus } from "@/platform/auth/service";
import { ButtonLink } from "@/ui";
import { ResetForm } from "./ResetForm";

export const metadata = { title: "Đặt lại mật khẩu" };
export const dynamic = "force-dynamic";

const BAD = {
  invalid: "Liên kết không hợp lệ.",
  expired: "Liên kết đã hết hạn (hiệu lực 30 phút).",
  used: "Liên kết đã được sử dụng.",
} as const;

/** SYS-05 Reset Password. The token is only checked here; it is consumed when the form is submitted. */
export default async function ResetPasswordPage({ searchParams }: { searchParams: Promise<{ token?: string }> }) {
  const { token } = await searchParams;
  const status = await resetTokenStatus(token);
  if (status !== "ok") {
    return (
      <div className="mx-auto flex w-full max-w-sm flex-1 flex-col items-center pt-12 text-center">
        <span className="grid size-16 place-items-center rounded-full bg-expense-soft text-expense">
          <LinkIcon size={28} />
        </span>
        <h1 className="mt-4 text-[22px] font-extrabold text-ink">{BAD[status]}</h1>
        <p className="mt-1 mb-6 text-[15px] text-muted">Hãy yêu cầu liên kết đặt lại mật khẩu mới.</p>
        <ButtonLink href="/forgot-password" block>
          Yêu cầu liên kết mới
        </ButtonLink>
        <Link href="/login" className="mt-4 text-[14px] font-semibold text-primary">
          Về đăng nhập
        </Link>
      </div>
    );
  }
  return <ResetForm token={token as string} />;
}

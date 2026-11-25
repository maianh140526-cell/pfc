import { requireMember } from "@/platform/auth/session";
import { AppHeader } from "@/ui";
import { PasswordForm } from "./PasswordForm";

export const metadata = { title: "Đổi mật khẩu" };

/** MEM-05 Change Password (mockup 267). */
export default async function PasswordPage() {
  await requireMember("/more/password");
  return (
    <>
      <AppHeader back backFallback="/more" title="Đổi mật khẩu" />
      <PasswordForm />
    </>
  );
}

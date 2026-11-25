import { ForgotForm } from "./ForgotForm";

export const metadata = { title: "Quên mật khẩu" };

/** SYS-04 Forgot Password. */
export default async function ForgotPasswordPage({ searchParams }: { searchParams: Promise<{ email?: string }> }) {
  const { email } = await searchParams;
  return <ForgotForm initialEmail={typeof email === "string" ? email.slice(0, 254) : ""} />;
}

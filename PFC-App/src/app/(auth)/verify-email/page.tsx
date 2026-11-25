import { VerifyEmail } from "./VerifyEmail";

export const metadata = { title: "Xác thực email" };

/** SYS-06 Email Verification. Confirmation is a button (POST), so mail scanners that open links cannot use it up. */
export default async function VerifyEmailPage({ searchParams }: { searchParams: Promise<{ token?: string }> }) {
  const { token } = await searchParams;
  return <VerifyEmail token={typeof token === "string" ? token : ""} />;
}

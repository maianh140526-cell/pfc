import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { CHALLENGE_COOKIE, openChallenge } from "@/platform/auth/challenge";
import { TwoFactorForm } from "./TwoFactorForm";

export const metadata = { title: "Xác thực hai lớp" };
export const dynamic = "force-dynamic";

/** Second sign-in step (mockup 268 / 98 OTP). Only reachable right after a correct first step. */
export default async function TwoFactorLoginPage() {
  const c = openChallenge((await cookies()).get(CHALLENGE_COOKIE)?.value, process.env.PFC_SESSION_SECRET ?? "", Math.floor(Date.now() / 1000));
  if (!c) redirect("/login?error=2fa_expired");
  return <TwoFactorForm />;
}

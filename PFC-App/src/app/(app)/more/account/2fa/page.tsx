import { getProfile, twoFactorStatus } from "@/platform/account/service";
import { requireMember } from "@/platform/auth/session";
import { AppHeader } from "@/ui";
import { TwoFactorSetup } from "./TwoFactorSetup";

export const metadata = { title: "Xác thực hai lớp" };
export const dynamic = "force-dynamic";

/** MEM-04 Security · Two-Factor Authentication (mockup 268). */
export default async function TwoFactorPage() {
  const me = await requireMember("/more/account/2fa");
  const [status, p] = await Promise.all([twoFactorStatus(me.id), getProfile(me.id)]);
  return (
    <>
      <AppHeader back backFallback="/more/account" title="Xác thực hai lớp (2FA)" />
      <TwoFactorSetup enabled={status.enabled} backupLeft={status.backupLeft} hasPassword={p.hasPassword} />
    </>
  );
}

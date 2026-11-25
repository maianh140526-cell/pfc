import { getProfile } from "@/platform/account/service";
import { requireMember } from "@/platform/auth/session";
import { AppHeader } from "@/ui";
import { ProfileForm } from "./ProfileForm";

export const metadata = { title: "Thông tin cá nhân" };
export const dynamic = "force-dynamic";

/** SYS-13 / MEM-02 Edit Profile (mockup 266). */
export default async function EditProfilePage() {
  const me = await requireMember("/more/account/profile");
  const p = await getProfile(me.id);
  return (
    <>
      <AppHeader back backFallback="/more/account" title="Thông tin cá nhân" />
      <ProfileForm profile={p} />
    </>
  );
}

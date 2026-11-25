import { redirect } from "next/navigation";
import { requireMember } from "@/platform/auth/session";
import { Onboarding } from "./Onboarding";

export const metadata = { title: "Bắt đầu" };
export const dynamic = "force-dynamic";

/** SYS-07 Onboarding (mockups 7, 92–94): shown once after the first sign-in. */
export default async function WelcomePage() {
  const me = await requireMember("/welcome");
  if (me.onboarded) redirect("/home");
  return <Onboarding name={me.fullName.split(/\s+/).at(-1) ?? me.fullName} />;
}

import { redirect } from "next/navigation";
import { safeNext } from "@/platform/auth/oauth";
import { currentMember } from "@/platform/auth/session";
import { AuthForm } from "../AuthForm";
import { enabledProviders, noticeFrom } from "../auth-page";

export const metadata = { title: "Đăng ký" };
export const dynamic = "force-dynamic";

/** SYS-03 Register. */
export default async function RegisterPage({ searchParams }: { searchParams: Promise<{ next?: string; error?: string }> }) {
  const q = await searchParams;
  if (await currentMember()) redirect("/home");
  return <AuthForm mode="register" next={q.next ? safeNext(q.next) : undefined} providers={enabledProviders()} notice={noticeFrom(q)} />;
}

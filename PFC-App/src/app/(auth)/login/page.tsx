import { redirect } from "next/navigation";
import { safeNext } from "@/platform/auth/oauth";
import { currentMember } from "@/platform/auth/session";
import { AuthForm } from "../AuthForm";
import { enabledProviders, noticeFrom } from "../auth-page";

export const metadata = { title: "Đăng nhập" };
export const dynamic = "force-dynamic";

/** SYS-02 Login. */
export default async function LoginPage({ searchParams }: { searchParams: Promise<{ next?: string; error?: string; reset?: string; verified?: string; deleted?: string }> }) {
  const q = await searchParams;
  if (await currentMember()) redirect(safeNext(q.next));
  return <AuthForm mode="login" next={q.next ? safeNext(q.next) : undefined} providers={enabledProviders()} notice={noticeFrom(q)} />;
}

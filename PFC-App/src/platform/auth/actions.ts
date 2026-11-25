"use server";

import bcrypt from "bcryptjs";
import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";
import { z } from "zod";
import { safeAction, type ActionResult } from "@/platform/action-result";
import { one, run } from "@/platform/db/client";
import { audit } from "@/platform/audit";
import { twoFactorStatus, verifySecondFactor } from "@/platform/account/service";
import { notify } from "@/platform/notifications/service";
import { CHALLENGE_COOKIE, CHALLENGE_TTL, openChallenge, sealChallenge } from "./challenge";
import { safeNext } from "./oauth";
import { passwordSchema } from "./password-policy";
import { recordReferral } from "@/modules/rewards/server/service";
import * as auth from "./service";
import { ActionError, endSession, requireMemberForAction, startSession } from "./session";

/** Client IP for rate limiting (first X-Forwarded-For hop set by the hosting proxy). */
async function clientIp(): Promise<string> {
  const h = await headers();
  return h.get("x-forwarded-for")?.split(",")[0]?.trim() || h.get("x-real-ip") || "local";
}

/** SYS-02 email + password, with "Ghi nhớ đăng nhập". */
const cookieBase = () => ({
  httpOnly: true,
  sameSite: "lax" as const,
  secure: process.env.NODE_ENV === "production" && process.env.PFC_INSECURE_COOKIES !== "1",
  path: "/",
});

export async function loginAction(input: { email?: unknown; password?: unknown; remember?: unknown }, next?: string): Promise<ActionResult> {
  let twoStep = false;
  const res = await safeAction(async () => {
    const id = await auth.passwordLogin({ email: input.email, password: input.password }, await clientIp());
    const remember = input.remember === true;
    if ((await twoFactorStatus(id)).enabled) {
      // Not signed in yet: the second step (mockup 268) finishes the login.
      (await cookies()).set(
        CHALLENGE_COOKIE,
        sealChallenge({ sub: id, remember, next: safeNext(next), exp: Math.floor(Date.now() / 1000) + CHALLENGE_TTL }, process.env.PFC_SESSION_SECRET ?? ""),
        { ...cookieBase(), maxAge: CHALLENGE_TTL },
      );
      twoStep = true;
      return;
    }
    await startSession(id, { remember });
  });
  if (res.ok) redirect(twoStep ? "/login/2fa" : safeNext(next));
  return res;
}

/** Second step of sign-in: 6-digit code from the authenticator app, or a backup code. */
export async function verifyTwoFactorAction(code: string): Promise<ActionResult> {
  let next = "/home";
  const res = await safeAction(async () => {
    const jar = await cookies();
    const c = openChallenge(jar.get(CHALLENGE_COOKIE)?.value, process.env.PFC_SESSION_SECRET ?? "", Math.floor(Date.now() / 1000));
    if (!c) throw new ActionError("Phiên xác thực đã hết hạn. Vui lòng đăng nhập lại.", "expired");
    if (!(await verifySecondFactor(c.sub, code))) throw new ActionError("Mã không đúng. Nhập mã mới nhất trong ứng dụng xác thực, hoặc một mã dự phòng.", "bad_code");
    jar.delete(CHALLENGE_COOKIE);
    await startSession(c.sub, { remember: c.remember });
    next = c.next;
  });
  if (res.ok) redirect(safeNext(next));
  return res;
}

/** SYS-03. When email verification is required the member is not signed in yet. */
export async function registerAction(input: unknown, next?: string): Promise<ActionResult<{ mustVerify: boolean }>> {
  const res = await safeAction(async () => {
    const r = await auth.registerMember(input, await clientIp());
    const ref = (await cookies()).get("pfc_ref")?.value;
    if (ref) await recordReferral(r.id, ref);
    if (!r.mustVerify) await startSession(r.id, { remember: true });
    return { mustVerify: r.mustVerify };
  });
  if (res.ok && !res.data.mustVerify) redirect(safeNext(next));
  return res;
}

export async function resendVerificationAction(email: string): Promise<ActionResult> {
  return safeAction(async () => {
    await auth.resendVerification(email, await clientIp());
    return undefined;
  });
}

/** SYS-06: verification is a POST from the page (link scanners that prefetch GETs cannot consume it). */
export async function verifyEmailAction(token: string): Promise<ActionResult> {
  return safeAction(async () => {
    await auth.verifyEmail(token);
    return undefined;
  });
}

/** SYS-04. Always the same answer, whether or not the email has an account. */
export async function forgotPasswordAction(email: string): Promise<ActionResult> {
  return safeAction(async () => {
    await auth.requestPasswordReset(email, await clientIp());
    return undefined;
  });
}

/** SYS-05. Signs out every device; the member logs in again with the new password. */
export async function resetPasswordAction(input: unknown): Promise<ActionResult> {
  const res = await safeAction(async () => {
    await auth.resetPassword(input);
    await endSession();
  });
  if (res.ok) redirect("/login?reset=1");
  return res;
}

export async function logoutAction(): Promise<void> {
  await endSession();
  redirect("/login");
}

const changePasswordSchema = z
  .object({ current: z.string().min(1, "Nhập mật khẩu hiện tại."), next: passwordSchema, confirm: z.string() })
  .refine((v) => v.next === v.confirm, { message: "Mật khẩu xác nhận không khớp." });

/** Changing the password signs out other devices and keeps this one signed in. */
export async function changePasswordAction(input: unknown): Promise<ActionResult> {
  return safeAction(async () => {
    const me = await requireMemberForAction();
    const data = changePasswordSchema.parse(input);
    const row = await one<{ password_hash: string }>("SELECT password_hash FROM members WHERE id = ?", [me.id]);
    if (row && !row.password_hash.startsWith("$2")) {
      throw new ActionError("Tài khoản đăng nhập bằng Google/Facebook chưa có mật khẩu. Dùng “Quên mật khẩu?” ở màn hình đăng nhập để tạo.");
    }
    if (!row || !(await bcrypt.compare(data.current, row.password_hash))) {
      await audit(me.id, "member.change_password", `member:${me.id}`, "failure");
      throw new ActionError("Mật khẩu hiện tại không đúng.");
    }
    await run("UPDATE members SET password_hash = ?, session_version = session_version + 1, updated_at = ? WHERE id = ?", [
      await bcrypt.hash(data.next, 12),
      new Date().toISOString(),
      me.id,
    ]);
    await startSession(me.id, { remember: true });
    await audit(me.id, "member.change_password", `member:${me.id}`, "success");
    await notify(me.id, { category: "account", title: "Bạn vừa đổi mật khẩu", body: "Các thiết bị khác đã được đăng xuất.", href: "/more/account/devices" });
    return undefined;
  });
}

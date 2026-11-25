"use server";

import QRCode from "qrcode";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { safeAction, type ActionResult } from "@/platform/action-result";
import { currentSessionId, endSession, requireMemberForAction, revokeOtherSessions, revokeSession, toActor } from "@/platform/auth/session";
import { audit } from "@/platform/audit";
import { ActionError } from "@/platform/errors";
import * as acc from "./service";

async function act<T>(fn: (me: Awaited<ReturnType<typeof requireMemberForAction>>) => Promise<T>, path = "/more"): Promise<ActionResult<T>> {
  return safeAction(async () => {
    const me = await requireMemberForAction();
    const out = await fn(me);
    revalidatePath(path, "layout");
    return out;
  });
}

export const updateProfileAction = async (input: unknown) => act((me) => acc.updateProfile(toActor(me), input));
export const setAvatarAction = async (url: string | null) => act((me) => acc.setAvatar(toActor(me), url));
export const requestEmailChangeAction = async (input: unknown) => act((me) => acc.requestEmailChange(toActor(me), input));
export const confirmEmailChangeAction = async (token: string) =>
  safeAction(async () => {
    await acc.confirmEmailChange(token);
    return undefined;
  });
export const setLocaleAction = async (locale: string) => act((me) => acc.setLocale(toActor(me), locale));
export const setPrivacyAction = async (input: unknown) => act((me) => acc.setPrivacy(toActor(me), input));
export const unlinkIdentityAction = async (provider: string) => act((me) => acc.unlinkIdentity(toActor(me), provider));

/** SYS-07: saves interests, then Home. */
export async function completeOnboardingAction(interests: string[]): Promise<ActionResult> {
  const res = await act((me) => acc.completeOnboarding(toActor(me), interests), "/home");
  if (res.ok) redirect("/home");
  return res;
}

/** Mockup 268 step 1–2: secret + QR (SVG data URL, generated on the server; nothing sent to third parties). */
export const startTwoFactorAction = async () =>
  act(async (me) => {
    const { secret, otpauth } = await acc.startTwoFactor(toActor(me));
    const svg = await QRCode.toString(otpauth, { type: "svg", margin: 1, errorCorrectionLevel: "M" });
    return { secret, qr: `data:image/svg+xml;base64,${Buffer.from(svg).toString("base64")}` };
  });
export const confirmTwoFactorAction = async (code: string) => act((me) => acc.confirmTwoFactor(toActor(me), code));
export const disableTwoFactorAction = async (input: unknown) => act((me) => acc.disableTwoFactor(toActor(me), input));

/** Mockup 269. */
export const revokeSessionAction = async (sessionId: string) =>
  act(async (me) => {
    if (sessionId === (await currentSessionId())) throw new ActionError("Đây là thiết bị hiện tại — dùng nút Đăng xuất.");
    if (!(await revokeSession(me.id, sessionId))) throw new ActionError("Thiết bị đã đăng xuất từ trước.");
    await audit(me.id, "member.session_revoke", `member:${me.id}`, "success");
  });
export const revokeOtherSessionsAction = async () =>
  act(async (me) => {
    const n = await revokeOtherSessions(me.id, await currentSessionId());
    await audit(me.id, "member.session_revoke_others", `member:${me.id}`, "success");
    return n;
  });

/** Mockup 275 "Xóa dữ liệu". Irreversible; signs out and leaves to the login screen. */
export async function deleteAccountAction(input: unknown): Promise<ActionResult> {
  const res = await safeAction(async () => {
    const me = await requireMemberForAction();
    await acc.deleteAccount(toActor(me), input);
    await endSession();
  });
  if (res.ok) redirect("/login?deleted=1");
  return res;
}

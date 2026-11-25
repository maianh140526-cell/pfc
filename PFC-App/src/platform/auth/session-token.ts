import { createHmac, timingSafeEqual } from "node:crypto";

/**
 * Stateless signed session token: base64url(payload).base64url(HMAC-SHA256).
 * Pure (secret passed in) so it can be unit tested. Same scheme as Club CM-104.
 */
/** `ver` = members.session_version at sign-in; bumping it (password reset) revokes every session. */
export type SessionPayload = { sub: string; exp: number; ver: number; sid?: string };

export const SESSION_COOKIE = "pfc_session";
/** "Ghi nhớ đăng nhập": persistent cookie. */
export const SESSION_TTL_SECONDS = 60 * 60 * 24 * 30;
/** Without "Ghi nhớ": browser-session cookie, and the token itself expires after 12 h. */
export const SHORT_SESSION_TTL_SECONDS = 60 * 60 * 12;

function sign(data: string, secret: string): string {
  return createHmac("sha256", secret).update(data).digest("base64url");
}

export function createSessionToken(memberId: string, secret: string, nowSec: number, ttl = SESSION_TTL_SECONDS, ver = 0, sid?: string): string {
  if (!secret) throw new Error("PFC_SESSION_SECRET is not set");
  const payload = Buffer.from(JSON.stringify({ sub: memberId, exp: nowSec + ttl, ver, ...(sid ? { sid } : {}) })).toString("base64url");
  return `${payload}.${sign(payload, secret)}`;
}

export function verifySessionToken(token: string | undefined, secret: string, nowSec: number): SessionPayload | null {
  if (!token || !secret) return null;
  const [payload, sig] = token.split(".");
  if (!payload || !sig) return null;
  const expected = Buffer.from(sign(payload, secret));
  const given = Buffer.from(sig);
  if (expected.length !== given.length || !timingSafeEqual(expected, given)) return null;
  try {
    const body = JSON.parse(Buffer.from(payload, "base64url").toString("utf8")) as Partial<SessionPayload>;
    if (typeof body.sub !== "string" || typeof body.exp !== "number" || body.exp <= nowSec) return null;
    return { sub: body.sub, exp: body.exp, ver: typeof body.ver === "number" ? body.ver : 0, ...(typeof body.sid === "string" ? { sid: body.sid } : {}) };
  } catch {
    return null;
  }
}

import { createHmac, timingSafeEqual } from "node:crypto";

/**
 * Pending second-factor sign-in (mockup 268): after a correct password / social login the member is NOT
 * signed in yet; this short-lived signed cookie remembers who passed step one. Pure (secret passed in).
 */
export const CHALLENGE_COOKIE = "pfc_2fa";
export const CHALLENGE_TTL = 5 * 60;
export type Challenge = { sub: string; remember: boolean; next: string; exp: number };

const sign = (data: string, secret: string) => createHmac("sha256", `2fa:${secret}`).update(data).digest("base64url");

export function sealChallenge(c: Challenge, secret: string): string {
  const body = Buffer.from(JSON.stringify(c)).toString("base64url");
  return `${body}.${sign(body, secret)}`;
}

export function openChallenge(raw: string | undefined, secret: string, nowSec: number): Challenge | null {
  if (!raw || !secret) return null;
  const [body, sig] = raw.split(".");
  if (!body || !sig) return null;
  const a = Buffer.from(sign(body, secret));
  const b = Buffer.from(sig);
  if (a.length !== b.length || !timingSafeEqual(a, b)) return null;
  try {
    const c = JSON.parse(Buffer.from(body, "base64url").toString("utf8")) as Challenge;
    if (typeof c.sub !== "string" || typeof c.next !== "string" || typeof c.exp !== "number" || c.exp <= nowSec) return null;
    return c;
  } catch {
    return null;
  }
}

import { createHmac } from "node:crypto";

/**
 * PFC App is the Platform identity provider (ADR-011). For each hub request made by a signed-in
 * PFC member without a hub session, the gateway mints a short-lived HS256 token and exchanges it
 * server-side for the hub's own session cookie. Pure function: secret and clock passed in.
 */
export const PLATFORM_ISSUER = "pfc-platform";
export const TOKEN_TTL_SECONDS = 60;

export function mintPlatformToken(
  claims: { sub: string; email: string; name: string; pfc_role?: string; pfc_department?: string | null },
  audience: string,
  secret: string,
  nowSec: number,
): string {
  if (!secret || secret.length < 16) throw new Error("Hub SSO secret missing or too short");
  const b64 = (o: unknown) => Buffer.from(JSON.stringify(o)).toString("base64url");
  const head = b64({ alg: "HS256", typ: "JWT" });
  const body = b64({ ...claims, iss: PLATFORM_ISSUER, aud: audience, iat: nowSec, exp: nowSec + TOKEN_TTL_SECONDS });
  const sig = createHmac("sha256", secret).update(`${head}.${body}`).digest("base64url");
  return `${head}.${body}.${sig}`;
}

/**
 * Binds a hub session cookie to the PFC member it was minted for. Without this, a hub cookie
 * left over from another identity (older login, shared device) would be reused as-is.
 */
export function ownerTag(hub: string, memberId: string, secret: string): string {
  return createHmac("sha256", secret).update(`hub-owner:${hub}:${memberId}`).digest("base64url").slice(0, 32);
}

export const ownerCookieName = (hubCookie: string) => `${hubCookie}_owner`;

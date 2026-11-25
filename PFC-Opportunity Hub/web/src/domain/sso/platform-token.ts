import { createHmac, timingSafeEqual } from "node:crypto";

/**
 * Verifies a PFC Platform (PFC App) HS256 id_token for Opportunity Hub.
 * Pure: secret and clock are passed in. Returns null on any failure (fail closed).
 */
/** pfcRole / pfcDepartment: the member's PFC platform role, used to grant posting / review rights (platform-grant.ts). */
export type PlatformClaims = { sub: string; email: string; name: string; pfcRole: string | null; pfcDepartment: string | null };

export const OPP_AUDIENCE = "pfc-opportunity";
export const PLATFORM_ISSUER = "pfc-platform";

export function verifyPlatformToken(token: string, secret: string, nowSec: number): PlatformClaims | null {
  if (!secret || secret.length < 16 || typeof token !== "string") return null;
  const parts = token.split(".");
  if (parts.length !== 3) return null;
  const [head, body, sig] = parts;
  let header: Record<string, unknown>;
  let claims: Record<string, unknown>;
  try {
    header = JSON.parse(Buffer.from(head, "base64url").toString("utf8"));
    claims = JSON.parse(Buffer.from(body, "base64url").toString("utf8"));
  } catch {
    return null;
  }
  if (header.alg !== "HS256") return null;
  const expected = Buffer.from(createHmac("sha256", secret).update(`${head}.${body}`).digest("base64url"));
  const given = Buffer.from(sig);
  if (expected.length !== given.length || !timingSafeEqual(expected, given)) return null;
  if (claims.iss !== PLATFORM_ISSUER || claims.aud !== OPP_AUDIENCE) return null;
  if (typeof claims.exp !== "number" || claims.exp <= nowSec) return null;
  // Tokens are minted per request; refuse anything valid for more than 5 minutes.
  if (typeof claims.iat === "number" && claims.exp - claims.iat > 300) return null;
  const email = typeof claims.email === "string" ? claims.email.trim().toLowerCase() : "";
  const sub = typeof claims.sub === "string" ? claims.sub : "";
  const name = typeof claims.name === "string" && claims.name.trim() ? claims.name.trim() : email;
  if (!sub || !/^[^@\s]+@[^@\s]+$/.test(email)) return null;
  const str = (v: unknown) => (typeof v === "string" && /^[a-z_]{2,30}$/.test(v) ? v : null);
  return { sub, email, name: name.slice(0, 120), pfcRole: str(claims.pfc_role), pfcDepartment: str(claims.pfc_department) };
}

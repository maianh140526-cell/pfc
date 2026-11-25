import { createHash, createHmac, randomBytes, timingSafeEqual } from "node:crypto";

/**
 * Social sign-in (SYS-02: Google, Facebook) — authorization-code flow, server-side only.
 * Pure helpers (no Next / DB) so they are unit tested. Client secrets never reach the browser.
 */
export const PROVIDERS = ["google", "facebook"] as const;
export type Provider = (typeof PROVIDERS)[number];
export const PROVIDER_LABEL: Record<Provider, string> = { google: "Google", facebook: "Facebook" };

export function isProvider(v: unknown): v is Provider {
  return typeof v === "string" && (PROVIDERS as readonly string[]).includes(v);
}

export type ProviderConfig = { clientId: string; clientSecret: string; redirectUri: string };

const ENDPOINTS = {
  google: {
    authorize: "https://accounts.google.com/o/oauth2/v2/auth",
    token: "https://oauth2.googleapis.com/token",
    profile: "https://openidconnect.googleapis.com/v1/userinfo",
    scope: "openid email profile",
  },
  facebook: {
    authorize: "https://www.facebook.com/v19.0/dialog/oauth",
    token: "https://graph.facebook.com/v19.0/oauth/access_token",
    profile: "https://graph.facebook.com/v19.0/me?fields=id,name,email",
    scope: "email,public_profile",
  },
} as const;
export const OAUTH_ENDPOINTS = ENDPOINTS;

/** Reads `GOOGLE_CLIENT_ID/SECRET`, `FACEBOOK_APP_ID/SECRET`; null when not configured. */
export function providerConfig(p: Provider, env: Record<string, string | undefined>, publicUrl: string): ProviderConfig | null {
  const id = p === "google" ? env.GOOGLE_CLIENT_ID : env.FACEBOOK_APP_ID;
  const secret = p === "google" ? env.GOOGLE_CLIENT_SECRET : env.FACEBOOK_APP_SECRET;
  if (!id || !secret) return null;
  return { clientId: id, clientSecret: secret, redirectUri: `${publicUrl.replace(/\/$/, "")}/api/auth/oauth/${p}/callback` };
}

export const b64url = (b: Buffer) => b.toString("base64url");
export const randomToken = (bytes = 32) => b64url(randomBytes(bytes));
export const pkceChallenge = (verifier: string) => b64url(createHash("sha256").update(verifier).digest());

export function authorizeUrl(p: Provider, cfg: ProviderConfig, state: string, codeVerifier: string): string {
  const e = ENDPOINTS[p];
  const q = new URLSearchParams({ client_id: cfg.clientId, redirect_uri: cfg.redirectUri, response_type: "code", scope: e.scope, state });
  q.set("code_challenge", pkceChallenge(codeVerifier));
  q.set("code_challenge_method", "S256");
  if (p === "google") q.set("prompt", "select_account");
  return `${e.authorize}?${q.toString()}`;
}

// ───────────── State cookie (CSRF + PKCE verifier + where to go back) ─────────────

/** link: id of the signed-in member who is linking this provider (mockup 273), instead of signing in. */
export type OAuthState = { p: Provider; state: string; verifier: string; next: string; remember: boolean; exp: number; link?: string };
export const OAUTH_COOKIE = "pfc_oauth";
export const OAUTH_STATE_TTL = 600;

const sign = (data: string, secret: string) => createHmac("sha256", `oauth:${secret}`).update(data).digest("base64url");

export function sealState(s: OAuthState, secret: string): string {
  const body = b64url(Buffer.from(JSON.stringify(s)));
  return `${body}.${sign(body, secret)}`;
}

export function openState(raw: string | undefined, secret: string, nowSec: number): OAuthState | null {
  if (!raw || !secret) return null;
  const [body, sig] = raw.split(".");
  if (!body || !sig) return null;
  const a = Buffer.from(sign(body, secret));
  const b = Buffer.from(sig);
  if (a.length !== b.length || !timingSafeEqual(a, b)) return null;
  try {
    const s = JSON.parse(Buffer.from(body, "base64url").toString("utf8")) as OAuthState;
    if (!isProvider(s.p) || typeof s.state !== "string" || typeof s.verifier !== "string" || s.exp <= nowSec) return null;
    return s;
  } catch {
    return null;
  }
}

/** Constant-time compare of the `state` query param with the sealed one. */
export function stateMatches(expected: string, given: string | null): boolean {
  if (!given) return false;
  const a = Buffer.from(expected);
  const b = Buffer.from(given);
  return a.length === b.length && timingSafeEqual(a, b);
}

// ───────────── Profiles ─────────────

/** `emailVerified` is only true when the provider asserts it (Google `email_verified`). */
export type SocialProfile = { provider: Provider; subject: string; email: string | null; emailVerified: boolean; name: string };

export function normaliseProfile(p: Provider, raw: unknown): SocialProfile | null {
  if (!raw || typeof raw !== "object") return null;
  const r = raw as Record<string, unknown>;
  const subject = p === "google" ? r.sub : r.id;
  if (typeof subject !== "string" || !subject) return null;
  const email = typeof r.email === "string" && r.email.includes("@") ? r.email.trim().toLowerCase() : null;
  const name = typeof r.name === "string" && r.name.trim() ? r.name.trim().slice(0, 80) : (email?.split("@")[0] ?? "Thành viên PFC");
  // Facebook does not tell us whether the email was confirmed, so we never treat it as verified.
  const emailVerified = p === "google" && (r.email_verified === true || r.email_verified === "true") && !!email;
  return { provider: p, subject, email, emailVerified, name };
}

/** Only same-site relative paths (no open redirect). */
export function safeNext(next: unknown): string {
  const s = typeof next === "string" ? next : "";
  return s.startsWith("/") && !s.startsWith("//") && !s.startsWith("/\\") ? s : "/home";
}

/** Single-use secrets (reset / verify links): the DB stores only the SHA-256. */
export function newOneTimeToken(): { token: string; hash: string } {
  const token = randomToken(32);
  return { token, hash: hashOneTimeToken(token) };
}
export const hashOneTimeToken = (token: string) => createHash("sha256").update(token).digest("hex");

/**
 * Google Sign-In as OIDC consumer (Club is not an IdP — ADR-008).
 * Live: Authorization Code + userinfo.
 * Dev: local demo claims when GOOGLE_OAUTH_MODE=dev (no Google project required).
 */
import { createHmac, randomBytes, timingSafeEqual } from "node:crypto";
import { AppError } from "@/lib/errors";

export type GoogleProfile = {
  sub: string;
  email: string;
  name: string;
  picture?: string | null;
};

export function googleOAuthConfig(env: NodeJS.ProcessEnv = process.env) {
  const clientId = (env.GOOGLE_CLIENT_ID ?? "").trim();
  const clientSecret = (env.GOOGLE_CLIENT_SECRET ?? "").trim();
  const modeRaw = (env.GOOGLE_OAUTH_MODE ?? "").toLowerCase();
  let mode: "off" | "dev" | "live" = "off";
  if (modeRaw === "dev" || modeRaw === "live" || modeRaw === "off") {
    mode = modeRaw;
  } else if (clientId && clientSecret) {
    mode = "live";
  }
  const redirectUri =
    env.GOOGLE_REDIRECT_URI ??
    `${(env.CLUB_APP_PUBLIC_URL ?? "http://127.0.0.1:3000").replace(/\/$/, "")}/api/club/sso/google/callback`;
  return {
    mode,
    enabled: mode === "dev" || mode === "live",
    clientId,
    clientSecret,
    redirectUri,
    scopes: "openid email profile",
  };
}

export function isGoogleOAuthEnabled(): boolean {
  return googleOAuthConfig().enabled;
}

function b64url(buf: Buffer | string): string {
  const b = typeof buf === "string" ? Buffer.from(buf, "utf8") : buf;
  return b.toString("base64url");
}

export function createGoogleOAuthState(): string {
  return randomBytes(16).toString("hex");
}

/** Signed state payload to bind CSRF + optional return path. */
export function signGoogleState(
  state: string,
  secret = process.env.CLUB_SESSION_SECRET ?? "dev",
): string {
  const body = b64url(JSON.stringify({ s: state, t: Date.now() }));
  const sig = createHmac("sha256", secret).update(body).digest("base64url");
  return `${body}.${sig}`;
}

export function verifyGoogleState(
  packed: string,
  secret = process.env.CLUB_SESSION_SECRET ?? "dev",
  maxAgeMs = 15 * 60 * 1000,
): string {
  const [body, sig] = packed.split(".");
  if (!body || !sig) throw new AppError("SSO_INVALID", "Bad Google OAuth state", 400);
  const expected = createHmac("sha256", secret).update(body).digest("base64url");
  const a = Buffer.from(sig);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !timingSafeEqual(a, b)) {
    throw new AppError("SSO_INVALID", "Google OAuth state mismatch", 400);
  }
  const parsed = JSON.parse(
    Buffer.from(body, "base64url").toString("utf8"),
  ) as { s: string; t: number };
  if (Date.now() - (parsed.t ?? 0) > maxAgeMs) {
    throw new AppError("SSO_EXPIRED", "Google OAuth state expired", 401);
  }
  return parsed.s;
}

export function buildGoogleStartUrl(): { url: string; state: string; mode: string } {
  const cfg = googleOAuthConfig();
  if (!cfg.enabled) {
    throw new AppError("SSO_DISABLED", "Google Sign-In is not enabled", 400);
  }
  const state = createGoogleOAuthState();
  const packed = signGoogleState(state);

  if (cfg.mode === "dev") {
    const u = new URL(cfg.redirectUri);
    u.searchParams.set("dev", "1");
    u.searchParams.set("state", packed);
    return { url: u.toString(), state: packed, mode: "dev" };
  }

  if (!cfg.clientId || !cfg.clientSecret) {
    throw new AppError(
      "SSO_MISCONFIG",
      "GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET required",
      500,
    );
  }

  const u = new URL("https://accounts.google.com/o/oauth2/v2/auth");
  u.searchParams.set("client_id", cfg.clientId);
  u.searchParams.set("redirect_uri", cfg.redirectUri);
  u.searchParams.set("response_type", "code");
  u.searchParams.set("scope", cfg.scopes);
  u.searchParams.set("access_type", "online");
  u.searchParams.set("include_granted_scopes", "true");
  u.searchParams.set("prompt", "select_account");
  u.searchParams.set("state", packed);
  return { url: u.toString(), state: packed, mode: "live" };
}

export async function exchangeGoogleCode(code: string): Promise<GoogleProfile> {
  const cfg = googleOAuthConfig();
  if (cfg.mode !== "live") {
    throw new AppError("SSO_MISCONFIG", "Google live mode required for code exchange", 500);
  }
  const tokenRes = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      code,
      client_id: cfg.clientId,
      client_secret: cfg.clientSecret,
      redirect_uri: cfg.redirectUri,
      grant_type: "authorization_code",
    }),
  });
  if (!tokenRes.ok) {
    throw new AppError("SSO_INVALID", "Google token exchange failed", 401);
  }
  const tokenJson = (await tokenRes.json()) as {
    access_token?: string;
    id_token?: string;
  };
  if (!tokenJson.access_token) {
    throw new AppError("SSO_INVALID", "Google access_token missing", 401);
  }
  const profileRes = await fetch("https://www.googleapis.com/oauth2/v3/userinfo", {
    headers: { Authorization: `Bearer ${tokenJson.access_token}` },
  });
  if (!profileRes.ok) {
    throw new AppError("SSO_INVALID", "Google userinfo failed", 401);
  }
  const p = (await profileRes.json()) as {
    sub?: string;
    email?: string;
    name?: string;
    picture?: string;
    email_verified?: boolean;
  };
  if (!p.sub || !p.email) {
    throw new AppError("SSO_INVALID", "Google profile missing email/sub", 401);
  }
  return {
    sub: `google_${p.sub}`,
    email: p.email,
    name: p.name || p.email,
    picture: p.picture ?? null,
  };
}

/** Local demo profile (GOOGLE_OAUTH_MODE=dev). */
export function buildGoogleDevProfile(opts?: {
  email?: string;
  name?: string;
}): GoogleProfile {
  const email = (opts?.email ?? "google.demo@pfc.vn").trim().toLowerCase();
  return {
    sub: `google_dev_${email.split("@")[0]}`,
    email,
    name: opts?.name ?? "Google Demo User",
    picture: null,
  };
}

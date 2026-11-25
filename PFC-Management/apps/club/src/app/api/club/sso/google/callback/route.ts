import { NextResponse } from "next/server";
import { loginWithSsoClaims, newCorrelationId } from "@/lib/auth";
import { errorEnvelope, AppError } from "@/lib/errors";
import { seedDemo } from "@/db/migrate";
import { ensureSsoMemberOnboarding } from "@/server/clubs";
import {
  buildGoogleDevProfile,
  exchangeGoogleCode,
  googleOAuthConfig,
  isGoogleOAuthEnabled,
  verifyGoogleState,
} from "@/platform/google-oauth";

export async function GET(req: Request) {
  const correlationId = newCorrelationId();
  try {
    await seedDemo();
    if (!isGoogleOAuthEnabled()) {
      throw new AppError("SSO_DISABLED", "Google Sign-In is not enabled", 400);
    }
    const url = new URL(req.url);
    const state = url.searchParams.get("state") ?? "";
    if (!state) {
      throw new AppError("SSO_INVALID", "Missing OAuth state", 400);
    }
    verifyGoogleState(state);

    const cfg = googleOAuthConfig();
    let profile;
    if (cfg.mode === "dev" || url.searchParams.get("dev") === "1") {
      profile = buildGoogleDevProfile({
        email: url.searchParams.get("email") ?? undefined,
        name: url.searchParams.get("name") ?? undefined,
      });
    } else {
      const code = url.searchParams.get("code") ?? "";
      if (!code) {
        throw new AppError("SSO_INVALID", "Missing Google authorization code", 400);
      }
      profile = await exchangeGoogleCode(code);
    }

    const user = await loginWithSsoClaims({
      sub: profile.sub,
      email: profile.email,
      name: profile.name,
      picture: profile.picture,
    });
    ensureSsoMemberOnboarding(user);
    return NextResponse.redirect(new URL("/lobby", req.url));
  } catch (err) {
    const envelope = errorEnvelope(err, correlationId);
    const login = new URL("/login", req.url);
    login.searchParams.set("sso_error", envelope.error?.code ?? "GOOGLE_SSO_ERROR");
    return NextResponse.redirect(login);
  }
}

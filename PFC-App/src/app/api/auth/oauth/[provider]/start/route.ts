import { NextResponse, type NextRequest } from "next/server";
import { OAUTH_COOKIE, OAUTH_STATE_TTL, authorizeUrl, isProvider, providerConfig, randomToken, safeNext, sealState } from "@/platform/auth/oauth";
import { currentMember } from "@/platform/auth/session";
import { publicUrl } from "@/platform/mail";

export const dynamic = "force-dynamic";

/** Starts Google / Facebook sign-in: state + PKCE sealed in a short-lived httpOnly cookie. */
export async function GET(req: NextRequest, { params }: { params: Promise<{ provider: string }> }) {
  const { provider } = await params;
  const back = (code: string) => NextResponse.redirect(new URL(`/login?error=${code}`, req.url));
  if (!isProvider(provider)) return back("oauth_invalid");
  const cfg = providerConfig(provider, process.env, publicUrl());
  const secret = process.env.PFC_SESSION_SECRET ?? "";
  if (!cfg || !secret) return back("oauth_unconfigured");

  const state = randomToken(24);
  const verifier = randomToken(48);
  const next = safeNext(req.nextUrl.searchParams.get("next"));
  const remember = req.nextUrl.searchParams.get("remember") !== "0";
  // ?link=1 from "Liên kết tài khoản": only for a signed-in member, who stays the same account.
  let link: string | undefined;
  if (req.nextUrl.searchParams.get("link") === "1") {
    const me = await currentMember();
    if (!me) return back("oauth_state");
    link = me.id;
  }
  const res = NextResponse.redirect(authorizeUrl(provider, cfg, state, verifier));
  res.cookies.set(OAUTH_COOKIE, sealState({ p: provider, state, verifier, next: link ? "/more/account/linked" : next, remember, exp: Math.floor(Date.now() / 1000) + OAUTH_STATE_TTL, ...(link ? { link } : {}) }, secret), {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production" && process.env.PFC_INSECURE_COOKIES !== "1",
    path: "/api/auth/oauth",
    maxAge: OAUTH_STATE_TTL,
  });
  return res;
}

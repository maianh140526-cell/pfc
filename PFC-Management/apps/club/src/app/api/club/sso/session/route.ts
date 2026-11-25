import { NextResponse } from "next/server";
import { loginWithSsoClaims, newCorrelationId } from "@/lib/auth";
import { AppError, errorEnvelope } from "@/lib/errors";
import { isSsoEnabled, parseSsoClaimsFromIdToken } from "@/platform/sso";

/**
 * ADR-008 A — Platform session exchange for the PFC App gateway.
 *
 * PFC App (Platform Core identity) posts a short-lived HS256 id_token; Club links/creates the
 * member by platform sub/email and sets its own session cookie. Unlike /sso/callback, this
 * endpoint does NOT create or activate a club membership: joining the private club still
 * goes through join_club → approval (CLUB.md "Private club → cần duyệt").
 */
export async function POST(req: Request) {
  const correlationId = newCorrelationId();
  try {
    if (!isSsoEnabled()) throw new AppError("SSO_DISABLED", "Platform SSO is not enabled", 400);
    const body = (await req.json().catch(() => ({}))) as { id_token?: unknown };
    const idToken = typeof body.id_token === "string" ? body.id_token : "";
    if (!idToken) throw new AppError("SSO_INVALID", "Missing id_token", 400);
    const claims = parseSsoClaimsFromIdToken(idToken);
    const user = await loginWithSsoClaims(claims);
    return NextResponse.json({ ok: true, user: { id: user.id }, correlationId });
  } catch (err) {
    const e = errorEnvelope(err, correlationId);
    return NextResponse.json(e, { status: e.status });
  }
}

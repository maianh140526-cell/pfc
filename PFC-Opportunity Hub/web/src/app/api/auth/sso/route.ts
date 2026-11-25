import { randomBytes } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { createSession, hashPassword } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { rateLimit } from "@/lib/rate-limit";
import { verifyPlatformToken } from "@/domain/sso/platform-token";
import { nextHubRole, platformGrant } from "@/domain/sso/platform-grant";

/**
 * Platform session exchange (PFC App gateway → Opportunity Hub).
 * Verifies a short-lived HS256 token from PFC App, finds the member by email (or creates one), syncs the
 * rights that follow the PFC role (platform-grant.ts: Trưởng ban post as trusted partners, Ban điều hành /
 * Chủ nhiệm review), then sets the Opportunity session cookie. Roles assigned inside Opportunity Hub are kept.
 */
export async function POST(req: NextRequest) {
  const secret = process.env.OPP_SSO_SHARED_SECRET ?? "";
  if (!secret) return NextResponse.json({ error: "Platform SSO is not configured" }, { status: 503 });
  if (!rateLimit(`sso:${req.headers.get("x-forwarded-for") ?? "local"}`, 120, 60_000)) {
    return NextResponse.json({ error: "Too many requests" }, { status: 429 });
  }
  const body = (await req.json().catch(() => null)) as { id_token?: unknown } | null;
  const claims = verifyPlatformToken(typeof body?.id_token === "string" ? body.id_token : "", secret, Math.floor(Date.now() / 1000));
  if (!claims) return NextResponse.json({ error: "Invalid platform token" }, { status: 401 });

  let member =
    (await prisma.member.findUnique({ where: { email: claims.email } })) ??
    (await prisma.member.create({
      data: {
        email: claims.email,
        name: claims.name,
        role: "MEMBER",
        // Unusable password: platform users sign in through PFC App only.
        passwordHash: hashPassword(randomBytes(32).toString("hex")),
      },
    }));

  const grant = platformGrant(claims.pfcRole, claims.pfcDepartment);
  const platformProfile = await prisma.providerProfile.findFirst({ where: { memberId: member.id, status: { in: ["platform", "platform_inactive"] } } });
  const otherActive = await prisma.providerProfile.count({ where: { memberId: member.id, status: "active" } });
  if (grant) {
    if (platformProfile) {
      await prisma.providerProfile.update({ where: { id: platformProfile.id }, data: { displayName: grant.providerName, verificationTier: grant.tier, status: "platform" } });
    } else {
      await prisma.providerProfile.create({ data: { memberId: member.id, displayName: grant.providerName, verificationTier: grant.tier, status: "platform" } });
    }
  } else if (platformProfile?.status === "platform") {
    await prisma.providerProfile.update({ where: { id: platformProfile.id }, data: { status: "platform_inactive" } });
  }
  const role = nextHubRole(member.role, grant, platformProfile?.status === "platform", otherActive > 0);
  if (role !== member.role) member = await prisma.member.update({ where: { id: member.id }, data: { role } });

  await createSession(member.id);
  return NextResponse.json({ id: member.id, role: member.role });
}

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getProviderProfileId } from "@/lib/member";
import { assertTransition, statusOnSubmit } from "@/domain/opportunity/status";

type Ctx = { params: Promise<{ id: string }> };

/**
 * Draft → Pending (review queue), or Draft → Verified for Trusted Partners (post-reviewed; reviewers can take
 * it down). The client never chooses the status: it comes from the provider's verification tier.
 */
export async function POST(_req: NextRequest, ctx: Ctx) {
  const { id } = await ctx.params;
  const providerId = await getProviderProfileId();
  if (!providerId) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const opp = await prisma.oppOpportunity.findUnique({ where: { id }, include: { provider: { select: { verificationTier: true } } } });
  if (!opp || opp.providerId !== providerId) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  // Auto-check: external must have https URL; deadline must be in the future.
  if ((opp.applyMode === "EXTERNAL" || opp.applyMode === "BOTH") && (!opp.externalUrl || !opp.externalUrl.startsWith("https://"))) {
    return NextResponse.json({ error: "Auto-check failed: https externalUrl required" }, { status: 400 });
  }
  if (opp.deadlineAt && opp.deadlineAt.getTime() <= Date.now()) {
    return NextResponse.json({ error: "Hạn nộp đã qua — sửa hạn trước khi gửi." }, { status: 400 });
  }

  const target = statusOnSubmit(opp.provider.verificationTier);
  try {
    assertTransition(opp.status, "PENDING");
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 400 });
  }

  const updated = await prisma.oppOpportunity.update({
    where: { id },
    data: { status: target, publishedAt: target === "VERIFIED" ? new Date() : opp.publishedAt },
  });

  await prisma.oppVerificationDecision.create({
    data: {
      opportunityId: id,
      actorId: providerId,
      fromStatus: opp.status,
      toStatus: target,
      reason: target === "VERIFIED" ? "Trusted Partner: đăng thẳng, chờ hậu kiểm" : "Provider submitted for review",
    },
  });

  return NextResponse.json(updated);
}

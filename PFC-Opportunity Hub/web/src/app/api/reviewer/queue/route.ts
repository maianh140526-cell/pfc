import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { mustReviewer } from "@/lib/member";

/**
 * OPP-A04 Review queue: Pending posts, plus Trusted-Partner posts that went live on submit in the last 14 days
 * (post-review; a reviewer can take them down via POST /reviewer/queue/:id { decision: "REJECTED" }).
 */
export async function GET() {
  const actor = await mustReviewer();
  if (actor instanceof NextResponse) return actor;
  const include = { provider: { select: { displayName: true, verificationTier: true } } } as const;
  const items = await prisma.oppOpportunity.findMany({ where: { status: "PENDING" }, orderBy: { updatedAt: "asc" }, include });
  const postReview = await prisma.oppOpportunity.findMany({
    where: {
      status: "VERIFIED",
      publishedAt: { gte: new Date(Date.now() - 14 * 86_400_000) },
      provider: { verificationTier: "TRUSTED_PARTNER" },
    },
    orderBy: { publishedAt: "desc" },
    take: 50,
    include,
  });
  return NextResponse.json({ items, postReview });
}

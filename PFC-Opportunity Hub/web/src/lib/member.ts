import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { forbidden, getAuthUser, unauthorized, type AuthUser } from "@/lib/auth";

/** Logged-in member id, or null. Never defaults to a demo user. */
export async function getMemberId(): Promise<string | null> {
  const user = await getAuthUser();
  return user?.id ?? null;
}

export async function getAuth(): Promise<AuthUser | null> {
  return getAuthUser();
}

export async function mustMember(): Promise<string | NextResponse> {
  const user = await getAuthUser();
  if (!user) return unauthorized();
  return user.id;
}

export async function mustReviewer(): Promise<string | NextResponse> {
  const user = await getAuthUser();
  if (!user) return unauthorized();
  if (user.role !== "REVIEWER") return forbidden("Reviewer role required");
  return user.id;
}

export async function getProviderProfileId(): Promise<string | null> {
  const user = await getAuthUser();
  // Providers post; reviewers (Ban điều hành PFC) may also post through their platform profile.
  if (!user || (user.role !== "PROVIDER" && user.role !== "REVIEWER")) return null;
  const profile = await prisma.providerProfile.findFirst({
    where: { memberId: user.id, status: { in: ["active", "platform"] } },
    orderBy: { createdAt: "asc" },
  });
  return profile?.id ?? null;
}

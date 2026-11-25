import { NextResponse, type NextRequest } from "next/server";
import { publicUrl } from "@/platform/mail";

/** Referral link (MEM-14): remembers the code for 30 days, then opens sign-up. Credited after onboarding. */
export async function GET(_req: NextRequest, { params }: { params: Promise<{ code: string }> }) {
  const code = (await params).code.toUpperCase();
  const res = NextResponse.redirect(new URL("/register", publicUrl()), { status: 303 });
  if (/^[A-Z0-9]{7}$/.test(code)) {
    res.cookies.set("pfc_ref", code, { httpOnly: true, sameSite: "lax", secure: process.env.NODE_ENV === "production" && process.env.PFC_INSECURE_COOKIES !== "1", maxAge: 30 * 86400, path: "/" });
  }
  return res;
}

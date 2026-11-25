import { timingSafeEqual } from "node:crypto";
import { NextResponse, type NextRequest } from "next/server";
import { expireStale } from "@/modules/payments/server/service";
import { expireUnpaidOrders } from "@/modules/market/server/service";
import { runEventJobs } from "@/modules/events/server/service";
import { refreshFeed } from "@/modules/oppfeed/server/service";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

/**
 * Housekeeping (Vercel Cron, or any scheduler sending `Authorization: Bearer <CRON_SECRET>`):
 * expire abandoned VNPAY payments and orders (stock / seats come back), remind attendees, close finished events.
 */
export async function GET(req: NextRequest) {
  const secret = process.env.CRON_SECRET ?? "";
  const given = req.headers.get("authorization") ?? "";
  const want = `Bearer ${secret}`;
  if (secret.length < 16 || given.length !== want.length || !timingSafeEqual(Buffer.from(given), Buffer.from(want))) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const payments = await expireStale();
  const orders = await expireUnpaidOrders();
  const events = await runEventJobs();
  // Outside opportunity sources (UEB, job boards): a failing source must not fail the other jobs.
  const opportunities = await refreshFeed().catch(() => null);
  return NextResponse.json({ ok: true, payments, orders, opportunities, ...events }, { headers: { "cache-control": "no-store" } });
}

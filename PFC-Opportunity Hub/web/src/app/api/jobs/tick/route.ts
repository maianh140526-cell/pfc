import { timingSafeEqual } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { runDispatchJob } from "@/server/notification/dispatch";
import { runExpireJob, runRemindJob } from "@/server/jobs/opportunity-jobs";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

function authorized(req: NextRequest): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret || secret.length < 16) return false;
  // Vercel Cron sends "Authorization: Bearer <CRON_SECRET>"; manual callers may use x-cron-secret.
  const given = req.headers.get("authorization")?.replace(/^Bearer\s+/i, "") ?? req.headers.get("x-cron-secret") ?? "";
  const a = Buffer.from(given);
  const b = Buffer.from(secret);
  return a.length === b.length && timingSafeEqual(a, b);
}

/**
 * Serverless replacement for `npm run worker` (ADR-004 / ADR-005): one tick of expire → remind → dispatch.
 * Scheduled by vercel.json. Jobs only act on records still due, so re-running a tick does no extra work.
 */
export async function GET(req: NextRequest) {
  if (!authorized(req)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const expire = await runExpireJob();
  const remind = await runRemindJob();
  const dispatch = await runDispatchJob();
  const result = { ok: true, at: new Date().toISOString(), expire, remind, dispatch };
  console.log(JSON.stringify({ kind: "jobs_tick", ...result }));
  return NextResponse.json(result, { headers: { "cache-control": "no-store" } });
}

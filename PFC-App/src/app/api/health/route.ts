import { NextResponse } from "next/server";
import { one } from "@/platform/db/client";
import { checkEnv } from "@/platform/env";

export const dynamic = "force-dynamic";

async function probe(origin: string): Promise<"up" | "down"> {
  try {
    // Any HTTP answer means the service is reachable (auth endpoints answer 401 when signed out).
    await fetch(origin, { method: "HEAD", redirect: "manual", cache: "no-store", signal: AbortSignal.timeout(3000) });
    return "up";
  } catch {
    return "down";
  }
}

/**
 * Uptime / deploy check. Public, so it reports only up/down and whether config is complete,
 * never variable values or names.
 */
export async function GET() {
  let database: "up" | "down" = "down";
  try {
    await one("SELECT 1 AS ok");
    database = "up";
  } catch {
    database = "down";
  }
  const [club, opportunity] = await Promise.all([
    probe(process.env.CLUB_API_ORIGIN || "http://127.0.0.1:3000"),
    probe(process.env.OPP_API_ORIGIN || "http://127.0.0.1:3001"),
  ]);
  const production = process.env.NODE_ENV === "production" && process.env.PFC_ENV !== "local";
  const config = checkEnv(process.env, production).problems.length === 0 ? "ok" : "incomplete";
  const ok = database === "up" && config === "ok";
  return NextResponse.json(
    { ok, database, config, hubs: { club, opportunity }, at: new Date().toISOString() },
    { status: ok ? 200 : 503, headers: { "cache-control": "no-store" } },
  );
}

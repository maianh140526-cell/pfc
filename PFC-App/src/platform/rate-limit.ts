import "server-only";
import { createHash } from "node:crypto";
import { all, run } from "@/platform/db/client";

/**
 * Fixed-window rate limiter (NFR-S-007) stored in the central database, so limits hold across
 * every server instance (Vercel serverless). Keys are hashed: no email or IP is stored.
 */
const k = (key: string) => createHash("sha256").update(key).digest("hex");

async function bump(key: string, windowMs: number, now: number): Promise<{ count: number; resetAt: number }> {
  const rows = await all<{ count: number; reset_at: number }>(
    `INSERT INTO rate_limits (key, count, reset_at) VALUES (?, 1, ?)
     ON CONFLICT (key) DO UPDATE SET
       count = CASE WHEN rate_limits.reset_at <= ? THEN 1 ELSE rate_limits.count + 1 END,
       reset_at = CASE WHEN rate_limits.reset_at <= ? THEN excluded.reset_at ELSE rate_limits.reset_at END
     RETURNING count, reset_at`,
    [k(key), now + windowMs, now, now],
  );
  // Occasional housekeeping of expired windows.
  if (Math.random() < 0.02) await run("DELETE FROM rate_limits WHERE reset_at <= ?", [now]);
  return { count: Number(rows[0].count), resetAt: Number(rows[0].reset_at) };
}

/** Counts every call (registration, reset requests). */
export async function allowAttempt(key: string, limit: number, windowMs: number, now = Date.now()): Promise<boolean> {
  return (await bump(key, windowMs, now)).count <= limit;
}

/** Failure-only limiter (login): check before, record on failure, clear on success. */
export async function checkLimit(key: string, limit: number, now = Date.now()): Promise<{ ok: true } | { ok: false; retryAfterSec: number }> {
  const rows = await all<{ count: number; reset_at: number }>("SELECT count, reset_at FROM rate_limits WHERE key = ?", [k(key)]);
  const b = rows[0];
  if (!b || Number(b.reset_at) <= now || Number(b.count) < limit) return { ok: true };
  return { ok: false, retryAfterSec: Math.max(1, Math.ceil((Number(b.reset_at) - now) / 1000)) };
}

export async function recordFailure(key: string, windowMs: number, now = Date.now()): Promise<number> {
  return (await bump(key, windowMs, now)).count;
}

export async function clearLimit(key: string): Promise<void> {
  await run("DELETE FROM rate_limits WHERE key = ?", [k(key)]);
}

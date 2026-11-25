import { afterAll, describe, expect, it } from "vitest";
import { cleanupTempDbs, useTempDb } from "../../test/db";

useTempDb();
const { allowAttempt, checkLimit, clearLimit, recordFailure } = await import("./rate-limit");
const { all } = await import("@/platform/db/client");
afterAll(cleanupTempDbs);

describe("shared failure limiter", () => {
  it("blocks after N failures and reports the wait", async () => {
    const key = "login:test@pfc.vn";
    for (let i = 0; i < 5; i++) {
      expect((await checkLimit(key, 5, 1000)).ok).toBe(true);
      await recordFailure(key, 60_000, 1000);
    }
    expect(await checkLimit(key, 5, 31_000)).toEqual({ ok: false, retryAfterSec: 30 });
    expect((await checkLimit(key, 5, 61_000)).ok).toBe(true);
    // A new window starts from 1.
    expect(await recordFailure(key, 60_000, 61_000)).toBe(1);
  });
  it("is cleared by a success", async () => {
    const key = "login:clear@pfc.vn";
    for (let i = 0; i < 5; i++) await recordFailure(key, 60_000, 0);
    expect((await checkLimit(key, 5, 1)).ok).toBe(false);
    await clearLimit(key);
    expect((await checkLimit(key, 5, 1)).ok).toBe(true);
  });
  it("counts plain attempts and never stores the raw key", async () => {
    for (let i = 0; i < 3; i++) expect(await allowAttempt("register:a@b.vn", 3, 60_000, 0)).toBe(true);
    expect(await allowAttempt("register:a@b.vn", 3, 60_000, 0)).toBe(false);
    const keys = (await all<{ key: string }>("SELECT key FROM rate_limits")).map((r) => r.key);
    expect(keys.join(" ")).not.toContain("@");
    expect(keys.every((x) => /^[0-9a-f]{64}$/.test(x))).toBe(true);
  });
});

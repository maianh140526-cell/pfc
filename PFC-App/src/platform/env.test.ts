import { describe, expect, it } from "vitest";
import { checkEnv } from "./env";

const S = (c: string) => c.repeat(40);
const GOOD = {
  PFC_SESSION_SECRET: S("a"),
  CLUB_SSO_SECRET: S("b"),
  OPP_SSO_SECRET: S("c"),
  PFC_DB_URL: "libsql://pfc.turso.io",
  PFC_DB_AUTH_TOKEN: "t",
  PFC_PUBLIC_URL: "https://app.pfc.vn",
  CLUB_API_ORIGIN: "https://club.pfc.vn",
  OPP_API_ORIGIN: "https://opp.pfc.vn",
  PFC_MAIL_MODE: "resend",
  RESEND_API_KEY: "k",
  PFC_MAIL_FROM: "PFC <no-reply@pfc.vn>",
  PFC_STORAGE: "blob",
  BLOB_READ_WRITE_TOKEN: "b",
  PFC_OWNER_EMAILS: "leader@pfc.vn",
  PFC_ENCRYPTION_KEY: S("e"),
};

describe("production env check", () => {
  it("accepts a complete production config, warning only about optional social login", () => {
    const r = checkEnv(GOOD, true);
    expect(r.problems).toEqual([]);
    expect(r.warnings.join(" ")).toMatch(/Google/);
  });
  it("flags file databases, http URLs, missing mail/storage and weak secrets", () => {
    const r = checkEnv({ ...GOOD, PFC_DB_URL: "file:.data/pfc.sqlite", PFC_PUBLIC_URL: "http://x", PFC_MAIL_MODE: "log", PFC_STORAGE: "local", OPP_SSO_SECRET: "short" }, true);
    const names = r.problems.map((p) => p.split(":")[0]);
    expect(names).toEqual(expect.arrayContaining(["PFC_DB_URL", "PFC_PUBLIC_URL", "PFC_MAIL_MODE", "PFC_STORAGE", "OPP_SSO_SECRET"]));
  });
  it("refuses a hub secret equal to the session secret and insecure cookies", () => {
    const r = checkEnv({ ...GOOD, CLUB_SSO_SECRET: GOOD.PFC_SESSION_SECRET, PFC_INSECURE_COOKIES: "1" }, true);
    expect(r.problems.join(" ")).toMatch(/không được trùng/);
    expect(r.problems.join(" ")).toMatch(/PFC_INSECURE_COOKIES/);
  });
  it("is lenient in development, but still needs a session secret", () => {
    expect(checkEnv({ PFC_SESSION_SECRET: S("a") }, false).problems).toEqual([]);
    expect(checkEnv({}, false).problems[0]).toMatch(/PFC_SESSION_SECRET/);
  });
  it("requires a separate encryption key in production", () => {
    const { PFC_ENCRYPTION_KEY: _k, ...noKey } = GOOD;
    expect(checkEnv(noKey, true).problems.join(" ")).toMatch(/PFC_ENCRYPTION_KEY/);
    expect(checkEnv({ ...GOOD, PFC_ENCRYPTION_KEY: GOOD.PFC_SESSION_SECRET }, true).problems.join(" ")).toMatch(/không được trùng/);
  });
  it("never echoes values", () => {
    const r = checkEnv({ ...GOOD, PFC_PUBLIC_URL: "http://secret-host.internal" }, true);
    expect(JSON.stringify(r)).not.toContain("secret-host");
  });
});

describe("payments config", () => {
  it("requires both VNPAY keys, a sane fee and a long cron secret", () => {
    expect(checkEnv({ ...GOOD, VNPAY_TMN_CODE: "X" }, true).problems.join()).toMatch(/VNPAY_TMN_CODE/);
    expect(checkEnv({ ...GOOD, PFC_PLATFORM_FEE_BPS: "abc" }, true).problems.join()).toMatch(/PFC_PLATFORM_FEE_BPS/);
    expect(checkEnv({ ...GOOD, CRON_SECRET: "short" }, true).problems.join()).toMatch(/CRON_SECRET/);
    const ok = checkEnv({ ...GOOD, VNPAY_TMN_CODE: "X", VNPAY_HASH_SECRET: "Y", PFC_PLATFORM_FEE_BPS: "150", CRON_SECRET: S("z") }, true);
    expect(ok.problems).toEqual([]);
    expect(ok.warnings.join()).toMatch(/sandbox/);
  });
});

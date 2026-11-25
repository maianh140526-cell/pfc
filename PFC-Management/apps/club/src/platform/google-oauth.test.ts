import { afterEach, describe, expect, it } from "vitest";
import {
  buildGoogleStartUrl,
  googleOAuthConfig,
  signGoogleState,
  verifyGoogleState,
} from "./google-oauth";

const prev = { ...process.env };

afterEach(() => {
  process.env.GOOGLE_OAUTH_MODE = prev.GOOGLE_OAUTH_MODE;
  process.env.GOOGLE_CLIENT_ID = prev.GOOGLE_CLIENT_ID;
  process.env.GOOGLE_CLIENT_SECRET = prev.GOOGLE_CLIENT_SECRET;
});

describe("google-oauth", () => {
  it("dev mode builds callback start URL", () => {
    process.env.GOOGLE_OAUTH_MODE = "dev";
    process.env.GOOGLE_CLIENT_ID = "";
    process.env.GOOGLE_CLIENT_SECRET = "";
    const cfg = googleOAuthConfig();
    expect(cfg.enabled).toBe(true);
    expect(cfg.mode).toBe("dev");
    const started = buildGoogleStartUrl();
    expect(started.mode).toBe("dev");
    expect(started.url).toContain("/api/club/sso/google/callback");
    expect(started.url).toContain("dev=1");
    expect(() => verifyGoogleState(started.state)).not.toThrow();
  });

  it("state signature rejects tampering", () => {
    const packed = signGoogleState("abc");
    expect(() => verifyGoogleState(packed + "x")).toThrow();
  });
});

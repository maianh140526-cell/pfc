import { createHmac } from "node:crypto";
import { describe, expect, it } from "vitest";
import { HUB_CONFIG } from "./config";
import { mintPlatformToken, ownerTag } from "./sso";

const SECRET = "hub-sso-secret-0123456789";

describe("platform SSO token", () => {
  it("is a valid HS256 JWT for the given audience, valid for 60 seconds", () => {
    const t = mintPlatformToken({ sub: "m1", email: "a@pfc.vn", name: "A" }, "pfc-club", SECRET, 1000);
    const [h, b, s] = t.split(".");
    expect(createHmac("sha256", SECRET).update(`${h}.${b}`).digest("base64url")).toBe(s);
    const body = JSON.parse(Buffer.from(b, "base64url").toString());
    expect(body).toMatchObject({ sub: "m1", email: "a@pfc.vn", iss: "pfc-platform", aud: "pfc-club", iat: 1000, exp: 1060 });
  });
  it("refuses to mint without a strong secret", () => {
    expect(() => mintPlatformToken({ sub: "m", email: "a@b", name: "" }, "x", "short", 1)).toThrow();
  });
});

describe("one account: hub password logins are not reachable through the gateway", () => {
  it("blocks Opportunity auth endpoints except /auth/me", () => {
    const up = HUB_CONFIG.opp.upstreamPath;
    expect(up(["auth", "login"])).toBeNull();
    expect(up(["auth", "sso"])).toBeNull();
    expect(up(["auth", "logout"])).toBeNull();
    expect(up(["auth", "me"])).toBe("/api/auth/me");
  });
  it("blocks Club login / SSO start actions", () => {
    expect(HUB_CONFIG.club.blockedActions).toEqual(expect.arrayContaining(["login", "sso_start", "google_start"]));
  });
});

describe("hub session ownership", () => {
  it("binds a hub session to one PFC member and one hub", () => {
    const a = ownerTag("club", "member-a", SECRET);
    expect(a).toBe(ownerTag("club", "member-a", SECRET));
    expect(a).not.toBe(ownerTag("club", "member-b", SECRET));
    expect(a).not.toBe(ownerTag("opp", "member-a", SECRET));
    expect(a).not.toBe(ownerTag("club", "member-a", "other-secret-0123456789"));
  });
});

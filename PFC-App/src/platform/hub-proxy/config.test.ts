import { describe, expect, it } from "vitest";
import { HUB_CONFIG, filterSetCookie, pickCookie } from "./config";

describe("hub proxy path policy", () => {
  it("maps allowed Opportunity paths and blocks the rest", () => {
    const up = HUB_CONFIG.opp.upstreamPath;
    expect(up(["opportunities"])).toBe("/api/opportunities");
    expect(up(["me", "applications", "abc123", "confirm-external"])).toBe("/api/me/applications/abc123/confirm-external");
    expect(up(["jobs", "expire"])).toBeNull();
    expect(up([])).toBeNull();
    expect(up(["opportunities", ".."])).toBeNull();
    expect(up(["opportunities", "a%2Fb"])).toBeNull();
  });
  it("only allows the Club root action endpoint", () => {
    expect(HUB_CONFIG.club.upstreamPath([])).toBe("/api/club");
    expect(HUB_CONFIG.club.upstreamPath(["sso", "callback"])).toBeNull();
    expect(HUB_CONFIG.club.blocked?.(new URLSearchParams("action=bootstrap"))).toBe(true);
    expect(HUB_CONFIG.club.blocked?.(new URLSearchParams("action=home"))).toBe(false);
  });
});

describe("cookie isolation", () => {
  it("forwards only the hub's own cookie", () => {
    const header = "pfc_session=PLATFORM; pfc_opp_session=OPP=X; other=1";
    expect(pickCookie(header, "pfc_opp_session")).toBe("pfc_opp_session=OPP=X");
    expect(pickCookie(header, "pfc_club_session")).toBeNull();
    expect(pickCookie(null, "x")).toBeNull();
  });
  it("accepts only the hub's own Set-Cookie and strips Domain", () => {
    expect(filterSetCookie("pfc_session=evil; Path=/", "pfc_opp_session")).toBeNull();
    expect(filterSetCookie("pfc_opp_session=t; Path=/; Domain=127.0.0.1; HttpOnly", "pfc_opp_session")).toBe(
      "pfc_opp_session=t; Path=/; HttpOnly",
    );
  });
});

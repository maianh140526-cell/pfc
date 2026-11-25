import { describe, expect, it } from "vitest";
import { authorizeUrl, hashOneTimeToken, newOneTimeToken, normaliseProfile, openState, pkceChallenge, providerConfig, safeNext, sealState, stateMatches } from "./oauth";

const SECRET = "test-secret-0123456789";

describe("oauth helpers", () => {
  it("is not configured without both id and secret", () => {
    expect(providerConfig("google", { GOOGLE_CLIENT_ID: "x" }, "https://pfc.vn")).toBeNull();
    expect(providerConfig("facebook", { FACEBOOK_APP_ID: "a", FACEBOOK_APP_SECRET: "b" }, "https://pfc.vn/")?.redirectUri).toBe("https://pfc.vn/api/auth/oauth/facebook/callback");
  });
  it("builds an authorize URL with state and PKCE S256, never the secret", () => {
    const cfg = providerConfig("google", { GOOGLE_CLIENT_ID: "cid", GOOGLE_CLIENT_SECRET: "shh" }, "http://localhost:3200")!;
    const u = new URL(authorizeUrl("google", cfg, "st", "verifier"));
    expect(u.searchParams.get("state")).toBe("st");
    expect(u.searchParams.get("code_challenge")).toBe(pkceChallenge("verifier"));
    expect(u.searchParams.get("code_challenge_method")).toBe("S256");
    expect(u.toString()).not.toContain("shh");
  });
  it("seals state and rejects tampering, expiry and wrong secret", () => {
    const s = { p: "google" as const, state: "abc", verifier: "v", next: "/home", remember: true, exp: 100 };
    const sealed = sealState(s, SECRET);
    expect(openState(sealed, SECRET, 50)).toEqual(s);
    expect(openState(sealed, SECRET, 100)).toBeNull();
    expect(openState(sealed, "other", 50)).toBeNull();
    const [, sig] = sealed.split(".");
    const forged = Buffer.from(JSON.stringify({ ...s, next: "https://evil.example" })).toString("base64url");
    expect(openState(`${forged}.${sig}`, SECRET, 50)).toBeNull();
    expect(stateMatches("abc", "abc")).toBe(true);
    expect(stateMatches("abc", "abd")).toBe(false);
    expect(stateMatches("abc", null)).toBe(false);
  });
  it("normalises profiles; only Google can assert a verified email", () => {
    expect(normaliseProfile("google", { sub: "1", email: "A@Gmail.com", email_verified: true, name: "An" })).toEqual({
      provider: "google",
      subject: "1",
      email: "a@gmail.com",
      emailVerified: true,
      name: "An",
    });
    expect(normaliseProfile("google", { sub: "1", email: "a@gmail.com", email_verified: false })?.emailVerified).toBe(false);
    expect(normaliseProfile("facebook", { id: "9", email: "b@x.vn", name: "Bình" })?.emailVerified).toBe(false);
    expect(normaliseProfile("facebook", { id: "9" })?.email).toBeNull();
    expect(normaliseProfile("google", { email: "x@y.z" })).toBeNull();
  });
  it("only allows same-site next paths", () => {
    expect(safeNext("/projects")).toBe("/projects");
    expect(safeNext("//evil.com")).toBe("/home");
    expect(safeNext("https://evil.com")).toBe("/home");
    expect(safeNext("/\\evil.com")).toBe("/home");
  });
  it("one-time tokens are random and stored hashed", () => {
    const a = newOneTimeToken();
    expect(a.hash).toBe(hashOneTimeToken(a.token));
    expect(a.hash).not.toContain(a.token);
    expect(newOneTimeToken().token).not.toBe(a.token);
  });
});

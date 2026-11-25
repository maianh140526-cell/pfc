import { describe, expect, it } from "vitest";
import { createSessionToken, verifySessionToken } from "./session-token";

const SECRET = "test-secret-0123456789";

describe("session token", () => {
  it("round-trips a valid token", () => {
    const t = createSessionToken("m1", SECRET, 1000);
    expect(verifySessionToken(t, SECRET, 1001)?.sub).toBe("m1");
  });
  it("rejects expired, tampered, wrong-secret and malformed tokens", () => {
    const t = createSessionToken("m1", SECRET, 1000, 10);
    expect(verifySessionToken(t, SECRET, 1010)).toBeNull();
    const [p, s] = t.split(".");
    const forged = Buffer.from(JSON.stringify({ sub: "admin", exp: 9e9 })).toString("base64url");
    expect(verifySessionToken(`${forged}.${s}`, SECRET, 1001)).toBeNull();
    expect(verifySessionToken(`${p}.${s}`, "other-secret", 1001)).toBeNull();
    expect(verifySessionToken("garbage", SECRET, 1001)).toBeNull();
    expect(verifySessionToken(undefined, SECRET, 1001)).toBeNull();
  });
  it("refuses to sign without a secret", () => {
    expect(() => createSessionToken("m1", "", 1)).toThrow();
  });
});

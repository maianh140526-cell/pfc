import { describe, expect, it } from "vitest";
import { base32Decode, base32Encode, hashBackupCode, newBackupCodes, newTotpSecret, otpauthUrl, seal, totpAt, unseal, verifyTotp } from "./totp";

// RFC 6238 Appendix B secret "12345678901234567890" (SHA-1), 8-digit vectors truncated to 6 digits.
const RFC = base32Encode(Buffer.from("12345678901234567890"));
const KEY = "k".repeat(40);

describe("TOTP", () => {
  it("matches RFC 6238 test vectors", () => {
    expect(totpAt(RFC, Math.floor(59 / 30), 8)).toBe("94287082");
    expect(totpAt(RFC, Math.floor(1111111109 / 30), 8)).toBe("07081804");
    expect(totpAt(RFC, Math.floor(1234567890 / 30), 8)).toBe("89005924");
    expect(totpAt(RFC, Math.floor(2000000000 / 30), 8)).toBe("69279037");
  });
  it("base32 round-trips", () => {
    const s = newTotpSecret();
    expect(s).toMatch(/^[A-Z2-7]{32}$/);
    expect(base32Encode(base32Decode(s))).toBe(s);
  });
  it("accepts ±1 step, rejects replays and bad input", () => {
    const now = 1_700_000_000_000;
    const step = Math.floor(now / 30000);
    const code = totpAt(RFC, step);
    expect(verifyTotp(RFC, code, now)).toBe(step);
    expect(verifyTotp(RFC, totpAt(RFC, step - 1), now)).toBe(step - 1);
    expect(verifyTotp(RFC, totpAt(RFC, step - 2), now)).toBeNull();
    expect(verifyTotp(RFC, code, now, step)).toBeNull(); // already used
    expect(verifyTotp(RFC, "12345", now)).toBeNull();
    expect(verifyTotp(RFC, "abcdef", now)).toBeNull();
    expect(verifyTotp(RFC, code.slice(0, 3) + " " + code.slice(3), now)).toBe(step);
  });
  it("builds an otpauth URL for authenticator apps", () => {
    const u = otpauthUrl("ABC", "a@pfc.vn");
    expect(u).toMatch(/^otpauth:\/\/totp\/PFC%3Aa%40pfc\.vn\?secret=ABC&issuer=PFC/);
  });
});

describe("backup codes & encryption", () => {
  it("makes 8 distinct codes; hashing ignores case and dashes", () => {
    const codes = newBackupCodes();
    expect(new Set(codes).size).toBe(8);
    expect(codes[0]).toMatch(/^[0-9A-Z]{4}-[0-9A-Z]{4}$/);
    expect(hashBackupCode(codes[0].toLowerCase().replace("-", ""))).toBe(hashBackupCode(codes[0]));
  });
  it("encrypts secrets at rest and detects tampering / wrong key", () => {
    const sealed = seal("SECRET123", KEY);
    expect(sealed).not.toContain("SECRET123");
    expect(unseal(sealed, KEY)).toBe("SECRET123");
    expect(() => unseal(sealed, "x".repeat(40))).toThrow();
    const [iv, tag, enc] = sealed.split(".");
    expect(() => unseal([iv, tag, enc.slice(0, -2) + "AA"].join("."), KEY)).toThrow();
    expect(() => seal("x", "short")).toThrow();
  });
});

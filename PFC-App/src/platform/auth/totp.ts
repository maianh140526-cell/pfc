import { createCipheriv, createDecipheriv, createHash, createHmac, hkdfSync, randomBytes, timingSafeEqual } from "node:crypto";

/**
 * Two-step login (mockup 268, MEM-04): TOTP per RFC 6238 (SHA-1, 6 digits, 30 s), compatible with
 * Google Authenticator, Microsoft Authenticator, Authy. Pure — secrets and time are passed in — so it is
 * unit tested against the RFC test vectors.
 */
const B32 = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";

export function base32Encode(buf: Buffer): string {
  let bits = 0;
  let value = 0;
  let out = "";
  for (const byte of buf) {
    value = (value << 8) | byte;
    bits += 8;
    while (bits >= 5) {
      out += B32[(value >>> (bits - 5)) & 31];
      bits -= 5;
    }
  }
  if (bits > 0) out += B32[(value << (5 - bits)) & 31];
  return out;
}

export function base32Decode(s: string): Buffer {
  const clean = s.toUpperCase().replace(/=+$/, "").replace(/\s/g, "");
  let bits = 0;
  let value = 0;
  const out: number[] = [];
  for (const c of clean) {
    const i = B32.indexOf(c);
    if (i < 0) throw new Error("invalid base32");
    value = (value << 5) | i;
    bits += 5;
    if (bits >= 8) {
      out.push((value >>> (bits - 8)) & 255);
      bits -= 8;
    }
  }
  return Buffer.from(out);
}

export const newTotpSecret = () => base32Encode(randomBytes(20));
export const STEP_SEC = 30;
export const stepAt = (nowMs: number) => Math.floor(nowMs / 1000 / STEP_SEC);

export function totpAt(secretB32: string, step: number, digits = 6): string {
  const counter = Buffer.alloc(8);
  counter.writeBigUInt64BE(BigInt(step));
  const h = createHmac("sha1", base32Decode(secretB32)).update(counter).digest();
  const o = h[h.length - 1] & 0xf;
  const code = ((h[o] & 0x7f) << 24) | (h[o + 1] << 16) | (h[o + 2] << 8) | h[o + 3];
  return String(code % 10 ** digits).padStart(digits, "0");
}

/**
 * Returns the matching time step (±1 step for clock drift) or null. Callers store the step and refuse
 * steps ≤ the last accepted one, so a code cannot be replayed.
 */
export function verifyTotp(secretB32: string, code: string, nowMs: number, lastStep = 0): number | null {
  const c = code.replace(/\s/g, "");
  if (!/^\d{6}$/.test(c)) return null;
  const now = stepAt(nowMs);
  for (const s of [now, now - 1, now + 1]) {
    if (s <= lastStep) continue;
    const expected = Buffer.from(totpAt(secretB32, s));
    if (timingSafeEqual(expected, Buffer.from(c))) return s;
  }
  return null;
}

export function otpauthUrl(secretB32: string, account: string, issuer = "PFC"): string {
  const label = encodeURIComponent(`${issuer}:${account}`);
  return `otpauth://totp/${label}?secret=${secretB32}&issuer=${encodeURIComponent(issuer)}&algorithm=SHA1&digits=6&period=30`;
}

// ───────────── Backup codes ─────────────

/** 8 one-time codes like "7K2P-9QXM". Store only hashes. */
export function newBackupCodes(n = 8): string[] {
  const alphabet = "23456789ABCDEFGHJKLMNPQRSTUVWXYZ";
  return Array.from({ length: n }, () => {
    const b = randomBytes(8);
    const s = Array.from(b, (x) => alphabet[x % alphabet.length]).join("");
    return `${s.slice(0, 4)}-${s.slice(4)}`;
  });
}
export const hashBackupCode = (code: string) => createHash("sha256").update(code.toUpperCase().replace(/[^0-9A-Z]/g, "")).digest("hex");

// ───────────── Encryption at rest ─────────────

/** AES-256-GCM with a key derived (HKDF) from PFC_ENCRYPTION_KEY. Output: iv.tag.ciphertext (base64url). */
function key(master: string): Buffer {
  if (!master || master.length < 32) throw new Error("PFC_ENCRYPTION_KEY must be ≥ 32 chars");
  return Buffer.from(hkdfSync("sha256", master, "pfc", "pfc-totp-secret-v1", 32));
}

export function seal(plain: string, master: string): string {
  const iv = randomBytes(12);
  const c = createCipheriv("aes-256-gcm", key(master), iv);
  const enc = Buffer.concat([c.update(plain, "utf8"), c.final()]);
  return [iv, c.getAuthTag(), enc].map((b) => b.toString("base64url")).join(".");
}

export function unseal(sealed: string, master: string): string {
  const [iv, tag, enc] = sealed.split(".").map((p) => Buffer.from(p, "base64url"));
  const d = createDecipheriv("aes-256-gcm", key(master), iv);
  d.setAuthTag(tag);
  return Buffer.concat([d.update(enc), d.final()]).toString("utf8");
}

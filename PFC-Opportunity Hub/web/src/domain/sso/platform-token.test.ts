import { test } from "node:test";
import assert from "node:assert/strict";
import { createHmac } from "node:crypto";
import { verifyPlatformToken } from "./platform-token";

const SECRET = "opp-platform-secret-0123456789";
const NOW = 1_800_000_000;

function sign(claims: Record<string, unknown>, secret = SECRET, alg = "HS256") {
  const b64 = (o: unknown) => Buffer.from(JSON.stringify(o)).toString("base64url");
  const head = b64({ alg, typ: "JWT" });
  const body = b64({ iss: "pfc-platform", aud: "pfc-opportunity", iat: NOW, exp: NOW + 60, ...claims });
  return `${head}.${body}.${createHmac("sha256", secret).update(`${head}.${body}`).digest("base64url")}`;
}

test("accepts a valid platform token and normalises email", () => {
  const c = verifyPlatformToken(sign({ sub: "m1", email: "Linh@PFC.vn", name: "Linh" }), SECRET, NOW);
  assert.deepEqual(c, { sub: "m1", email: "linh@pfc.vn", name: "Linh", pfcRole: null, pfcDepartment: null });
});

test("rejects wrong secret, wrong audience, wrong issuer, alg none, expiry and long-lived tokens", () => {
  const base = { sub: "m1", email: "a@b.vn", name: "A" };
  assert.equal(verifyPlatformToken(sign(base, "another-secret-0123456789"), SECRET, NOW), null);
  assert.equal(verifyPlatformToken(sign({ ...base, aud: "pfc-club" }), SECRET, NOW), null);
  assert.equal(verifyPlatformToken(sign({ ...base, iss: "evil" }), SECRET, NOW), null);
  assert.equal(verifyPlatformToken(sign(base, SECRET, "none"), SECRET, NOW), null);
  assert.equal(verifyPlatformToken(sign(base), SECRET, NOW + 61), null);
  assert.equal(verifyPlatformToken(sign({ ...base, exp: NOW + 3600 }), SECRET, NOW), null);
});

test("rejects malformed input and weak secrets", () => {
  assert.equal(verifyPlatformToken("a.b", SECRET, NOW), null);
  assert.equal(verifyPlatformToken(sign({ sub: "m1", email: "not-an-email" }), SECRET, NOW), null);
  assert.equal(verifyPlatformToken(sign({ sub: "m1", email: "a@b.vn" }, "short"), "short", NOW), null);
});

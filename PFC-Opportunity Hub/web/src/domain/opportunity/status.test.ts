import test from "node:test";
import assert from "node:assert/strict";
import {
  canTransition,
  isPubliclyVisible,
  assertHttpsUrl,
  statusOnSubmit,
} from "./status";

test("opportunity FSM allows Draft→Pending→Verified", () => {
  assert.equal(canTransition("DRAFT", "PENDING"), true);
  assert.equal(canTransition("PENDING", "VERIFIED"), true);
  assert.equal(canTransition("VERIFIED", "EXPIRED"), true);
  assert.equal(canTransition("DRAFT", "VERIFIED"), false);
});

test("public visibility only Verified and not expired", () => {
  assert.equal(isPubliclyVisible("VERIFIED", null), true);
  assert.equal(isPubliclyVisible("DRAFT", null), false);
  assert.equal(isPubliclyVisible("PENDING", null), false);
  const past = new Date(Date.now() - 1000);
  assert.equal(isPubliclyVisible("VERIFIED", past), false);
});

test("external URL must be https", () => {
  assert.doesNotThrow(() => assertHttpsUrl("https://example.com/apply"));
  assert.throws(() => assertHttpsUrl("http://example.com/apply"));
});

test("trusted partners publish on submit; others wait for review", () => {
  assert.equal(statusOnSubmit("TRUSTED_PARTNER"), "VERIFIED");
  assert.equal(statusOnSubmit("VERIFIED_PROVIDER"), "PENDING");
  assert.equal(statusOnSubmit("UNVERIFIED"), "PENDING");
  // post-review takedown stays possible
  assert.equal(canTransition("VERIFIED", "REJECTED"), true);
});

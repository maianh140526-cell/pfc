import { test } from "node:test";
import assert from "node:assert/strict";
import { nextHubRole, platformGrant } from "./platform-grant";

test("PFC leaders get posting rights as trusted partners; executives also review", () => {
  assert.deepEqual(platformGrant("truong_ban", "truyen_thong"), { role: "PROVIDER", providerName: "Ban Truyền thông · PFC", tier: "TRUSTED_PARTNER" });
  assert.equal(platformGrant("ban_dieu_hanh", null)?.role, "REVIEWER");
  assert.equal(platformGrant("chu_nhiem", null)?.providerName, "Ban điều hành PFC");
  assert.equal(platformGrant("thanh_vien", null), null);
  assert.equal(platformGrant(null, null), null);
});

test("hub roles follow the PFC role without overriding hub-assigned roles", () => {
  const g = platformGrant("truong_ban", "su_kien");
  assert.equal(nextHubRole("MEMBER", g, false, false), "PROVIDER");
  assert.equal(nextHubRole("REVIEWER", g, false, false), "REVIEWER");
  // demoted in PFC: the platform grant is withdrawn…
  assert.equal(nextHubRole("PROVIDER", null, true, false), "MEMBER");
  // …unless hub staff also made them a provider for another organisation
  assert.equal(nextHubRole("PROVIDER", null, true, true), "PROVIDER");
  // never touches providers / reviewers assigned inside Opportunity Hub
  assert.equal(nextHubRole("PROVIDER", null, false, true), "PROVIDER");
  assert.equal(nextHubRole("REVIEWER", null, false, false), "REVIEWER");
});

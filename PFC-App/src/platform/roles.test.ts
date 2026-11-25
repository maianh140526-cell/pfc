import { describe, expect, it } from "vitest";
import { PERMISSIONS, can, canManageResource, checkRoleChange, permissionsOf, type Actor, type Permission } from "./roles";

const owner: Actor = { id: "o", role: "chu_nhiem", department: null };
const exec: Actor = { id: "e", role: "ban_dieu_hanh", department: null };
const headCM: Actor = { id: "h1", role: "truong_ban", department: "chuyen_mon" };
const headTT: Actor = { id: "h2", role: "truong_ban", department: "truyen_thong" };
const member: Actor = { id: "m", role: "thanh_vien", department: null };

describe("platform permission matrix", () => {
  it("Chủ nhiệm can do everything", () => {
    for (const p of Object.keys(PERMISSIONS) as Permission[]) expect(can(owner, p)).toBe(true);
  });
  it("Thành viên has no power over other people's content or accounts", () => {
    expect(permissionsOf(member).size).toBe(0);
    expect(canManageResource(member, "someone-else", "edu.content.delete_any")).toBe(false);
    expect(canManageResource(member, "m", "edu.content.delete_any")).toBe(true); // own content
  });
  it("Trưởng ban gets only their department's grants", () => {
    expect(can(headCM, "edu.content.approve")).toBe(true);
    expect(can(headCM, "project.approve")).toBe(true);
    expect(can(headCM, "mkt.listing.approve")).toBe(false);
    expect(can(headTT, "mkt.listing.approve")).toBe(true);
    expect(can(headTT, "edu.content.approve")).toBe(false);
    for (const h of [headCM, headTT]) {
      expect(can(h, "admin.roles.manage")).toBe(false);
      expect(can(h, "admin.members.lock")).toBe(false);
      expect(can(h, "edu.content.delete_any")).toBe(false);
    }
  });
  it("Ban điều hành moderates but cannot manage roles or lock accounts", () => {
    expect(can(exec, "mkt.seller.approve")).toBe(true);
    expect(can(exec, "admin.roles.manage")).toBe(false);
    expect(can(exec, "admin.members.lock")).toBe(false);
  });
  it("a locked account loses every permission, even its own content", () => {
    const locked = { ...owner, locked: true };
    expect(permissionsOf(locked).size).toBe(0);
    expect(canManageResource(locked, "o", "edu.content.delete_any")).toBe(false);
  });
  it("role changes: only Chủ nhiệm, and never the last Chủ nhiệm", () => {
    expect(checkRoleChange({ actor: exec, targetId: "m", targetRole: "thanh_vien", newRole: "truong_ban", ownerCount: 1 })).toMatch(/Chủ nhiệm/);
    expect(checkRoleChange({ actor: owner, targetId: "o", targetRole: "chu_nhiem", newRole: "thanh_vien", ownerCount: 1 })).toMatch(/ít nhất/);
    expect(checkRoleChange({ actor: owner, targetId: "o", targetRole: "chu_nhiem", newRole: "thanh_vien", ownerCount: 2 })).toBeNull();
  });
});

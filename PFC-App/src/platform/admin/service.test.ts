import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { cleanupTempDbs, useTempDb } from "../../../test/db";

useTempDb();
const { makeMember } = await import("../../../test/members");
const { listMembers, setLocked, setRole } = await import("./service");
const { one } = await import("@/platform/db/client");

describe("admin service (real DB)", () => {
  let owner: Awaited<ReturnType<typeof makeMember>>;
  let member: Awaited<ReturnType<typeof makeMember>>;
  let head: Awaited<ReturnType<typeof makeMember>>;

  beforeAll(async () => {
    owner = await makeMember("chu_nhiem");
    member = await makeMember("thanh_vien");
    head = await makeMember("truong_ban", "chuyen_mon");
  });
  afterAll(cleanupTempDbs);

  it("member and Trưởng ban cannot list, promote or lock anyone", async () => {
    await expect(listMembers(member)).rejects.toThrow(/quyền/);
    await expect(setRole(member, head.id, "thanh_vien", null)).rejects.toThrow(/Chủ nhiệm/);
    await expect(setRole(head, member.id, "chu_nhiem", null)).rejects.toThrow(/Chủ nhiệm/);
    await expect(setLocked(head, member.id, true)).rejects.toThrow(/Chủ nhiệm/);
    const row = await one<{ role: string }>("SELECT role FROM members WHERE id = ?", [member.id]);
    expect(row?.role).toBe("thanh_vien");
  });

  it("Chủ nhiệm promotes a member to Trưởng ban (department required)", async () => {
    await expect(setRole(owner, member.id, "truong_ban", null)).rejects.toThrow(/ban phụ trách/);
    await setRole(owner, member.id, "truong_ban", "truyen_thong");
    const row = await one<{ role: string; department: string }>("SELECT role, department FROM members WHERE id = ?", [member.id]);
    expect(row).toMatchObject({ role: "truong_ban", department: "truyen_thong" });
  });

  it("the last Chủ nhiệm cannot demote themselves", async () => {
    await expect(setRole(owner, owner.id, "thanh_vien", null)).rejects.toThrow(/ít nhất/);
  });

  it("Chủ nhiệm can lock / unlock others but not themselves or another Chủ nhiệm", async () => {
    await setLocked(owner, head.id, true);
    expect((await one<{ locked: number }>("SELECT locked FROM members WHERE id = ?", [head.id]))?.locked).toBe(1);
    await setLocked(owner, head.id, false);
    await expect(setLocked(owner, owner.id, true)).rejects.toThrow(/tự khóa/);
    const owner2 = await makeMember("chu_nhiem");
    await expect(setLocked(owner, owner2.id, true)).rejects.toThrow(/Chủ nhiệm/);
  });

  it("role changes are audited", async () => {
    const r = await one<{ n: number }>("SELECT COUNT(*) AS n FROM audit_log WHERE action LIKE 'admin.set_role%'");
    expect(Number(r?.n)).toBeGreaterThan(0);
  });
});

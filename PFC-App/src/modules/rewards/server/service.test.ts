import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { cleanupTempDbs, useTempDb } from "../../../../test/db";

useTempDb();
vi.mock("@/platform/mail", () => ({ publicUrl: () => "http://localhost:3200", sendMail: async () => true }));
const { makeMember } = await import("../../../../test/members");
const rw = await import("./service");
const settings = await import("@/platform/settings/service");
const { listNotifications } = await import("@/platform/notifications/service");
afterAll(cleanupTempDbs);

type M = Awaited<ReturnType<typeof makeMember>>;
let a: M, b: M, boss: M, exec: M;
beforeAll(async () => {
  a = await makeMember("thanh_vien", null, "An");
  b = await makeMember("thanh_vien", null, "Bình");
  boss = await makeMember("chu_nhiem", null, "Chủ nhiệm");
  exec = await makeMember("ban_dieu_hanh", null, "BĐH");
});

describe("earning", () => {
  it("awards once per reference and respects the daily cap", async () => {
    expect(await rw.awardPoints(a.id, "course_complete", "c1")).toBe(50);
    expect(await rw.awardPoints(a.id, "course_complete", "c1")).toBe(0);
    for (const i of [1, 2, 3]) expect(await rw.awardPoints(a.id, "post_create", `p${i}`)).toBe(5);
    expect(await rw.awardPoints(a.id, "post_create", "p4")).toBe(0); // cap 3/day
    expect(await rw.balanceOf(a.id)).toEqual({ balance: 65, lifetime: 65 });
    expect((await listNotifications(a.id))[0].title).toMatch(/\+5 điểm/);
  });
  it("only the Chủ nhiệm changes rules and tiers; a big award moves the tier", async () => {
    await expect(settings.saveTiers(exec, [])).rejects.toThrow(/Chủ nhiệm/);
    await expect(settings.saveTiers(boss, [{ key: "member", label: "TV", min: 10, benefits: "" }])).rejects.toThrow(/từ 0/);
    await settings.saveTiers(boss, [
      { key: "member", label: "Thành viên", min: 0, benefits: "" },
      { key: "silver", label: "Bạc", min: 100, benefits: "Huy hiệu Bạc" },
    ]);
    await expect(rw.adjustPoints(a, a.id, 50, "tự cộng")).rejects.toThrow(/quyền/);
    await rw.adjustPoints(exec, a.id, 50, "Thưởng tình nguyện viên sự kiện");
    expect((await rw.overview(a)).tier.key).toBe("silver");
  });
});

describe("redeeming", () => {
  it("checks balance and stock, refunds on cancel, keeps the tier", async () => {
    await expect(rw.saveReward(a, null, { title: "Áo PFC", cost: 100 })).rejects.toThrow(/quyền/);
    const shirt = await rw.saveReward(exec, null, { title: "Áo PFC", cost: 100, stock: 1 });
    const big = await rw.saveReward(exec, null, { title: "Vé hội thảo", cost: 10_000, stock: null });
    await expect(rw.redeem(a, big)).rejects.toThrow(/Bạn cần/);
    const d = await rw.redeem(a, shirt);
    await expect(rw.redeem(b, shirt)).rejects.toThrow(/hết|Bạn cần/);
    expect((await rw.balanceOf(a.id)).balance).toBe(15);
    await expect(rw.decideRedemption(exec, d, false, "")).rejects.toThrow(/lý do/);
    await rw.decideRedemption(exec, d, false, "Hết size");
    expect(await rw.balanceOf(a.id)).toEqual({ balance: 115, lifetime: 115 });
    expect((await rw.overview(a)).tier.key).toBe("silver");
  });
});

describe("referrals", () => {
  it("credits the referrer once the new member finishes onboarding; self-referral ignored", async () => {
    const code = await rw.referralCode(b.id);
    expect(await rw.referralCode(b.id)).toBe(code);
    const newbie = await makeMember("thanh_vien", null, "Mới");
    await rw.recordReferral(newbie.id, code.toLowerCase());
    await rw.recordReferral(b.id, code);
    await rw.rewardReferral(newbie.id);
    await rw.rewardReferral(newbie.id);
    expect((await rw.balanceOf(b.id)).balance).toBe(100);
  });
  it("no points when rewards are switched off", async () => {
    await settings.setFlag(boss, "rewards", false);
    expect(await rw.awardPoints(b.id, "quiz_pass", "q1")).toBe(0);
    await settings.setFlag(boss, "rewards", true);
  });
});

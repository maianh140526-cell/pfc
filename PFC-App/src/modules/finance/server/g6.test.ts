import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { cleanupTempDbs, useTempDb } from "../../../../test/db";

useTempDb();
vi.mock("@/platform/mail", () => ({ publicUrl: () => "http://localhost:3200", sendMail: async () => true }));
const { makeMember } = await import("../../../../test/members");
const inv = await import("./invest");
const pl = await import("./places");
const edu = await import("@/modules/education/server/service");
const collab = await import("@/modules/projects/server/collab");
const rw = await import("@/modules/rewards/server/service");
const { run } = await import("@/platform/db/client");
afterAll(cleanupTempDbs);

type M = Awaited<ReturnType<typeof makeMember>>;
let a: M, b: M, tt: M, cm: M;
beforeAll(async () => {
  a = await makeMember("thanh_vien", null, "An");
  b = await makeMember("thanh_vien", null, "Bình");
  tt = await makeMember("truong_ban", "truyen_thong", "TB Truyền thông");
  cm = await makeMember("truong_ban", "chuyen_mon", "TB Chuyên môn");
});

describe("investments", () => {
  it("are owner-only and valued at the member's prices", async () => {
    const id = await inv.saveHolding(a.id, null, { name: "Vinamilk", symbol: "vnm", kind: "stock", quantity: 100, avgCost: 60_000, currentPrice: 66_000 });
    const { holdings, summary } = await inv.listHoldings(a.id);
    expect(holdings[0]).toMatchObject({ symbol: "VNM", value: 6_600_000, gain: 600_000 });
    expect(summary.gainPct).toBeCloseTo(10);
    expect((await inv.listHoldings(b.id)).holdings).toHaveLength(0);
    expect(await inv.getHolding(b.id, id)).toBeNull();
    await expect(inv.updatePrice(b.id, id, 1)).rejects.toThrow(/Không tìm thấy/);
    await expect(inv.deleteHolding(b.id, id)).rejects.toThrow(/Không tìm thấy/);
    await inv.updatePrice(a.id, id, 70_000);
    expect((await inv.getHolding(a.id, id))?.currentPrice).toBe(70_000);
  });
});

describe("places", () => {
  let pid = "";
  it("members share and review; duplicates are refused; reviews earn points once", async () => {
    pid = await pl.savePlace(a, null, { name: "Cơm bình dân Cô Lan", category: "food", address: "12 Chùa Láng, Đống Đa", area: "Đống Đa", priceLevel: 1 });
    await expect(pl.savePlace(b, null, { name: "cơm bình dân cô lan", category: "food", address: "12 chùa láng, đống đa", priceLevel: 1 })).rejects.toThrow(/đã có/);
    await expect(pl.savePlace(b, pid, { name: "Đổi tên", category: "food", address: "12 Chùa Láng", priceLevel: 1 })).rejects.toThrow(/người đăng/);
    await pl.reviewPlace(b, pid, { rating: 5, comment: "Cơm ngon, 35k no bụng, chủ quán dễ thương", avgSpend: 35000 });
    await pl.reviewPlace(b, pid, { rating: 4, comment: "Cơm ngon, 35k no bụng, chủ quán dễ thương", avgSpend: 40000 });
    const p = await pl.getPlace(a, pid);
    expect(p).toMatchObject({ rating: 4, reviews: 1, avgSpend: 40000 });
    expect((await rw.balanceOf(b.id)).balance).toBe(5);
  });
  it("only moderators hide, with a reason; hidden places leave the list", async () => {
    await expect(pl.setPlaceHidden(b, pid, true, "spam")).rejects.toThrow(/quyền/);
    await expect(pl.setPlaceHidden(tt, pid, true)).rejects.toThrow(/lý do/);
    await pl.setPlaceHidden(tt, pid, true, "Thông tin sai");
    expect((await pl.listPlaces(b)).some((x) => x.id === pid)).toBe(false);
    expect(await pl.getPlace(b, pid)).toBeNull();
    expect((await pl.getPlace(a, pid))?.hiddenReason).toBe("Thông tin sai");
  });
});

describe("timed quiz", () => {
  it("needs a server-side start and refuses late submissions", async () => {
    const q = await edu.createQuiz(cm, { title: "Thi nhanh 1 phút", topic: "finance", passPct: 50, timeLimitMin: 1 });
    await edu.saveQuestion(cm, q, null, { prompt: "Lãi kép là gì?", options: ["Lãi trên lãi", "Lãi đơn"], correctIndex: 0 });
    await edu.transition(cm, "quiz", q, "submit");
    const question = (await edu.getQuizForTaking(a, q))!;
    expect(question.timeLimitMin).toBe(1);
    await expect(edu.submitAttempt(a, q, { [question.questions[0].id]: 0 })).rejects.toThrow(/Bắt đầu/);
    expect((await edu.startAttempt(a, q)).deadline).toBeTruthy();
    expect(await edu.submitAttempt(a, q, { [question.questions[0].id]: 0 })).toBeTruthy();
    await edu.startAttempt(b, q);
    await run("UPDATE edu_attempt_starts SET started_at = ? WHERE member_id = ?", [new Date(Date.now() - 5 * 60_000).toISOString(), b.id]);
    await expect(edu.submitAttempt(b, q, {})).rejects.toThrow(/hết giờ/);
  });
});

describe("collaborators", () => {
  it("lists only open, member-visible profiles and filters by skill", async () => {
    await collab.saveCollabProfile(a, { headline: "SV Tài chính, mạnh Excel", skills: ["Excel", "phân tích"], availability: "part_time", open: true });
    await collab.saveCollabProfile(b, { headline: "Thiết kế slide đẹp", skills: ["design"], availability: "few_hours", open: false });
    expect((await collab.listCollaborators(cm)).map((x) => x.memberId)).toEqual([a.id]);
    expect(await collab.listCollaborators(cm, { skill: "excel" })).toHaveLength(1);
    expect(await collab.listCollaborators(cm, { skill: "design" })).toHaveLength(0);
    await run("UPDATE members SET privacy = json_object('profileVisibility', 'private') WHERE id = ?", [a.id]);
    expect(await collab.listCollaborators(cm)).toHaveLength(0);
  });
});

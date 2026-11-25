import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { cleanupTempDbs, useTempDb } from "../../../test/db";

useTempDb();
vi.mock("@/platform/mail", () => ({ publicUrl: () => "http://localhost:3200", sendMail: async () => true }));
const { makeMember } = await import("../../../test/members");
const c = await import("./console");
const com = await import("@/modules/community/server/service");
const { listNotifications } = await import("@/platform/notifications/service");
afterAll(cleanupTempDbs);

type M = Awaited<ReturnType<typeof makeMember>>;
let boss: M, exec: M, exec2: M, tt: M, mem: M, other: M;
beforeAll(async () => {
  boss = await makeMember("chu_nhiem", null, "Chủ nhiệm");
  exec = await makeMember("ban_dieu_hanh", null, "BĐH 1");
  exec2 = await makeMember("ban_dieu_hanh", null, "BĐH 2");
  tt = await makeMember("truong_ban", "truyen_thong", "TB Truyền thông");
  mem = await makeMember("thanh_vien", null, "Thành viên");
  other = await makeMember("thanh_vien", null, "Người khác");
});

describe("restrictions", () => {
  it("BĐH restricts members (not peers, not themselves); the member is blocked with the reason; lifting restores", async () => {
    await expect(c.restrict(mem, other.id, { kind: "community", reason: "Spam liên tục", days: 3 })).rejects.toThrow(/quyền/);
    await expect(c.restrict(exec, exec2.id, { kind: "community", reason: "Spam liên tục", days: 3 })).rejects.toThrow(/ngang hoặc cao hơn/);
    await expect(c.restrict(exec, exec.id, { kind: "community", reason: "Spam liên tục", days: 3 })).rejects.toThrow(/tự hạn chế/);
    await expect(c.restrict(exec, mem.id, { kind: "community", reason: "x", days: 3 })).rejects.toThrow(/lý do/);
    const rid = await c.restrict(exec, mem.id, { kind: "community", reason: "Spam quảng cáo nhiều lần", days: 3 });
    await expect(com.createPost(mem, { body: "Mua ngay hàng giá rẻ" })).rejects.toThrow(/hạn chế.*Spam quảng cáo/);
    expect((await listNotifications(mem.id))[0].title).toMatch(/bị hạn chế/);
    await c.liftRestriction(exec, rid);
    expect(await com.createPost(mem, { body: "Xin lỗi mọi người, mình sẽ chú ý hơn" })).toBeTruthy();
    expect((await c.memberDetail(exec, mem.id))?.restrictions[0].active).toBe(false);
  });
  it("only the Chủ nhiệm can restrict a BĐH member; nobody restricts a Chủ nhiệm", async () => {
    expect(await c.restrict(boss, exec2.id, { kind: "messages", reason: "Nhắn tin làm phiền thành viên", days: null })).toBeTruthy();
    await expect(c.restrict(boss, boss.id, { kind: "messages", reason: "Thử tự hạn chế", days: 1 })).rejects.toThrow();
  });
});

describe("dashboard, queues, audit", () => {
  it("members cannot open the console; queues follow permissions", async () => {
    await expect(c.dashboard(mem)).rejects.toThrow(/quyền/);
    await expect(c.auditLog(tt)).rejects.toThrow(/quyền/);
    const d = await c.dashboard(exec);
    expect(d.kpis.members).toBeGreaterThanOrEqual(6);
    expect((await c.queues(tt)).map((q) => q.key)).toEqual(expect.arrayContaining(["reports", "listings"]));
    expect((await c.queues(tt)).map((q) => q.key)).not.toContain("refunds");
    const log = await c.auditLog(exec, { view: "all", q: "admin.restrict" });
    expect(log.length).toBeGreaterThanOrEqual(2);
  });
});

describe("broadcast", () => {
  it("TB Truyền thông can broadcast to an audience; members cannot", async () => {
    await expect(c.sendCampaign(mem, { title: "Thông báo thử", audience: {} })).rejects.toThrow(/quyền/);
    expect(await c.previewAudience(tt, { roles: ["ban_dieu_hanh"] })).toBe(2);
    await expect(c.sendCampaign(tt, { title: "Họp BĐH tối nay", href: "https://evil.example", audience: { roles: ["ban_dieu_hanh"] } })).rejects.toThrow(/trang trong app/);
    const r = await c.sendCampaign(tt, { title: "Họp BĐH tối nay", body: "19h phòng 301", href: "/events", audience: { roles: ["ban_dieu_hanh"] } });
    expect(r.recipients).toBe(2);
    expect((await listNotifications(exec.id))[0].title).toBe("Họp BĐH tối nay");
    expect((await listNotifications(mem.id)).some((n) => n.title === "Họp BĐH tối nay")).toBe(false);
  });
});

describe("support tickets", () => {
  it("only the requester and support staff see a ticket; staff replies notify", async () => {
    const id = await c.createTicket(mem, { category: "account", subject: "Không đổi được email", body: "Mình bấm link xác nhận nhưng báo hết hạn." });
    expect(await c.getTicket(other, id)).toBeNull();
    await expect(c.replyTicket(other, id, "chen ngang")).rejects.toThrow();
    await expect(c.ticketInbox(mem)).rejects.toThrow(/quyền/);
    expect((await c.ticketInbox(exec)).map((t) => t.id)).toContain(id);
    await c.replyTicket(exec, id, "Bạn thử gửi lại link mới trong Cài đặt tài khoản nhé.");
    expect((await c.getTicket(mem, id))?.status).toBe("answered");
    expect((await listNotifications(mem.id))[0].title).toMatch(/Hỗ trợ PFC đã trả lời/);
    await c.closeTicket(mem, id);
    expect((await c.myTickets(mem))[0].status).toBe("closed");
  });
});

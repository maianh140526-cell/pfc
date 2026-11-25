import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { cleanupTempDbs, useTempDb } from "../../../test/db";

useTempDb();
const sent: { to: string; subject: string }[] = [];
const pushed: { memberId: string; title: string }[] = [];
vi.mock("@/platform/mail", () => ({ publicUrl: () => "http://localhost:3200", sendMail: async (m: { to: string; subject: string }) => (sent.push(m), true) }));
vi.mock("./push", () => ({ sendPush: async (memberId: string, p: { title: string }) => (pushed.push({ memberId, title: p.title }), 1) }));
const n = await import("./service");
const { validEndpoint } = await vi.importActual<typeof import("./push")>("./push");
const { effectivePref } = await import("./categories");
const { makeMember } = await import("../../../test/members");
afterAll(cleanupTempDbs);

type M = Awaited<ReturnType<typeof makeMember>>;
let a: M, b: M;
beforeAll(async () => {
  a = await makeMember();
  b = await makeMember();
});
const flush = () => new Promise((r) => setTimeout(r, 20));

describe("notification center", () => {
  it("stores, counts, marks read — per member only", async () => {
    await n.notify(a.id, { category: "market", title: "Đơn hàng mới #1", body: "Có người đặt mua.", href: "/market/orders/1" });
    await n.notify([a.id, b.id], { category: "projects", title: "Lời mời tham gia dự án" });
    await flush();
    expect(await n.unreadCount(a.id)).toBe(2);
    const list = await n.listNotifications(a.id);
    expect(list[0].title).toBe("Lời mời tham gia dự án");
    await n.markRead(b.id, list[0].id); // someone else's: no effect
    expect(await n.unreadCount(a.id)).toBe(2);
    await n.markRead(a.id, list[0].id);
    expect(await n.unreadCount(a.id)).toBe(1);
    expect(await n.markAllRead(a.id)).toBe(1);
    expect(await n.unreadCount(b.id)).toBe(1);
  });
  it("dedupes and rejects off-site links", async () => {
    await n.notify(b.id, { category: "learn", title: "Đã duyệt", dedupeKey: "course:1:approved" });
    await n.notify(b.id, { category: "learn", title: "Đã duyệt", dedupeKey: "course:1:approved" });
    await n.notify(b.id, { category: "learn", title: "Link lạ", href: "https://evil.example/x" });
    const list = await n.listNotifications(b.id, { category: "learn" });
    expect(list.filter((x) => x.title === "Đã duyệt")).toHaveLength(1);
    expect(list.find((x) => x.title === "Link lạ")?.href).toBeNull();
  });
  it("respects preferences; security notices cannot be turned off", async () => {
    sent.length = 0;
    pushed.length = 0;
    await n.setPref(a.id, "market", "email", false);
    await n.setPref(a.id, "market", "inapp", false);
    await n.setPref(a.id, "account", "email", false); // ignored
    await n.notify(a.id, { category: "market", title: "Không vào hộp thư" });
    await n.notify(a.id, { category: "account", title: "Đăng nhập mới" });
    await flush();
    expect(sent.map((m) => m.subject)).toEqual(["PFC · Đăng nhập mới"]);
    expect(pushed.map((p) => p.title)).toEqual(["Không vào hộp thư", "Đăng nhập mới"]);
    expect((await n.listNotifications(a.id)).some((x) => x.title === "Không vào hộp thư")).toBe(false);
    const prefs = await n.getPrefs(a.id);
    expect(prefs.market).toEqual({ inapp: false, email: false, push: true });
    expect(prefs.account.email).toBe(true);
    expect(effectivePref("learn", "email", {})).toBe(false);
  });
});

describe("push endpoint allow-list", () => {
  it("accepts real push services only", () => {
    expect(validEndpoint("https://fcm.googleapis.com/fcm/send/abc")).toBe(true);
    expect(validEndpoint("https://web.push.apple.com/QGx")).toBe(true);
    expect(validEndpoint("https://updates.push.services.mozilla.com/wpush/v2/x")).toBe(true);
    expect(validEndpoint("https://169.254.169.254/latest/meta-data")).toBe(false);
    expect(validEndpoint("https://fcm.googleapis.com.evil.example/x")).toBe(false);
    expect(validEndpoint("http://fcm.googleapis.com/x")).toBe(false);
    expect(validEndpoint("https://fcm.googleapis.com:8443/x")).toBe(false);
    expect(validEndpoint("https://localhost/x")).toBe(false);
  });
});

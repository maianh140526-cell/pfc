import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { cleanupTempDbs, useTempDb } from "../../../../test/db";

useTempDb();
process.env.VNPAY_TMN_CODE = "TESTTMN1";
process.env.VNPAY_HASH_SECRET = "test-secret-0123456789";
process.env.VNPAY_API_URL = "https://vnpay.invalid/api";
vi.mock("@/platform/mail", () => ({ publicUrl: () => "http://localhost:3200", sendMail: async () => true }));
const { makeMember } = await import("../../../../test/members");
const ev = await import("./service");
const pay = await import("@/modules/payments/server/service");
const { hmac512, signData } = await import("@/modules/payments/domain/vnpay");
const { vnLocal } = await import("../domain/events");
const { one } = await import("@/platform/db/client");
afterAll(cleanupTempDbs);

type M = Awaited<ReturnType<typeof makeMember>>;
let org: M, sk: M, a: M, b: M, c: M, boss: M;
const at = (days: number, h = 9) => vnLocal(new Date(Date.now() + days * 86400_000)).slice(0, 11) + `${String(h).padStart(2, "0")}:00`;
const base = (over: Record<string, unknown> = {}) => ({
  title: "Workshop Đầu tư chứng khoán",
  summary: "Nhập môn",
  mode: "offline",
  location: "Hội trường A, Học viện Tài chính",
  startsAt: at(10, 9),
  endsAt: at(10, 11),
  tickets: [{ name: "Miễn phí", price: 0, capacity: 2 }],
  ...over,
});

/** What VNPAY would send back to the Return URL / IPN for a payment URL we generated. */
function vnpayReturn(payUrl: string, code = "00", amountOverride?: number) {
  const u = new URL(payUrl);
  const q: Record<string, string> = {
    vnp_TmnCode: u.searchParams.get("vnp_TmnCode")!,
    vnp_TxnRef: u.searchParams.get("vnp_TxnRef")!,
    vnp_Amount: String(amountOverride ?? Number(u.searchParams.get("vnp_Amount"))),
    vnp_ResponseCode: code,
    vnp_TransactionStatus: code,
    vnp_TransactionNo: "14000001",
    vnp_BankCode: "NCB",
    vnp_PayDate: "20261120100000",
    vnp_OrderInfo: u.searchParams.get("vnp_OrderInfo")!,
  };
  return { ...q, vnp_SecureHash: hmac512(signData(q), process.env.VNPAY_HASH_SECRET!) };
}

beforeAll(async () => {
  org = await makeMember("thanh_vien", null, "Người tổ chức");
  sk = await makeMember("truong_ban", "su_kien", "TB Sự kiện");
  a = await makeMember("thanh_vien", null, "An");
  b = await makeMember("thanh_vien", null, "Bình");
  c = await makeMember("thanh_vien", null, "Chi");
  boss = await makeMember("chu_nhiem", null, "Chủ nhiệm");
});

const reg = (who: M, eventId: string, ticketTypeId: string, name = "Người tham dự") => ev.register(who, eventId, { ticketTypeId, name, email: "a@example.com" }, "127.0.0.1");

describe("lifecycle", () => {
  it("member events need approval; drafts are private; rejection needs a reason", async () => {
    await expect(ev.createEvent(org, base({ endsAt: at(10, 8) }))).rejects.toThrow(/sau thời gian bắt đầu/);
    await expect(ev.createEvent(org, base({ mode: "online", onlineUrl: "http://zoom.us/x" }))).rejects.toThrow(/https/);
    const id = await ev.createEvent(org, base());
    expect(await ev.getEvent(a, id)).toBeNull();
    expect(await ev.eventTransition(org, id, "submit")).toBe("submitted");
    await expect(ev.eventTransition(a, id, "approve")).rejects.toThrow(/quyền duyệt/);
    await expect(ev.eventTransition(sk, id, "reject")).rejects.toThrow(/lý do/);
    expect((await ev.approvalQueue(sk)).map((e) => e.id)).toContain(id);
    expect(await ev.eventTransition(sk, id, "approve")).toBe("published");
    expect((await ev.listEvents(a)).map((e) => e.id)).toContain(id);
  });
});

describe("free registration, capacity and check-in", () => {
  let id = "";
  let tt = "";
  it("caps seats per ticket type and blocks double registration", async () => {
    id = await ev.createEvent(sk, base({ title: "Talk miễn phí" }));
    expect(await ev.eventTransition(sk, id, "submit")).toBe("published"); // approvers publish directly
    tt = (await ev.getEvent(a, id))!.tickets[0].id;
    const r1 = await reg(a, id, tt, "An");
    expect(r1.payUrl).toBeNull();
    await expect(reg(a, id, tt)).rejects.toThrow(/đã đăng ký/);
    await reg(b, id, tt, "Bình");
    await expect(reg(c, id, tt)).rejects.toThrow(/đã hết/);
    const d = await ev.getEvent(c, id);
    expect(d?.tickets[0].left).toBe(0);
  });
  it("only organizers check in; a ticket checks in once", async () => {
    const t = (await ev.myTickets(a))[0];
    await expect(ev.checkIn(a, id, t.ticketCode)).rejects.toThrow(/người tổ chức/);
    expect(await ev.checkIn(sk, id, `PFC-EVT:${t.ticketCode}`)).toMatchObject({ ok: true, attendee: "An", collect: 0 });
    expect(await ev.checkIn(sk, id, t.ticketCode)).toMatchObject({ ok: false, error: expect.stringMatching(/đã được check-in/) });
    expect(await ev.checkIn(sk, id, "XXXXXXXXXXXX")).toMatchObject({ ok: false });
    expect((await ev.dashboard(sk, id)).checkedIn).toBe(1);
  });
  it("cancelling a free ticket frees the seat", async () => {
    const t = (await ev.myTickets(b))[0];
    await ev.cancelRegistration(b, t.id);
    await reg(c, id, tt, "Chi");
  });
});

describe("pay at door", () => {
  it("confirms unpaid and asks the door to collect before check-in", async () => {
    const id = await ev.createEvent(sk, base({ title: "Gala có phí", payAtDoor: true, tickets: [{ name: "Thường", price: 50000, capacity: null }] }));
    await ev.eventTransition(sk, id, "submit");
    const tt = (await ev.getEvent(a, id))!.tickets[0].id;
    const r = await reg(a, id, tt, "An");
    expect(r.payUrl).toBeNull();
    const t = await ev.getTicket(a, r.registrationId);
    expect(t).toMatchObject({ status: "confirmed", paid: false });
    expect(await ev.checkIn(sk, id, t!.ticketCode)).toMatchObject({ ok: true, collect: 50000 });
    expect(await ev.checkIn(sk, id, t!.ticketCode, true)).toMatchObject({ ok: true, collect: 0 });
    expect((await ev.dashboard(sk, id)).revenueDoor).toBe(50000);
  });
});

describe("paid online (VNPAY) tickets", () => {
  let id = "";
  let tt = "";
  let regA = "";
  let payUrlA = "";
  it("holds a seat while paying, confirms on a signed return, ignores forged or replayed results", async () => {
    id = await ev.createEvent(org, base({ title: "Khóa học phân tích BCTC", tickets: [{ name: "Vé", price: 100000, capacity: 1 }] }));
    await ev.eventTransition(org, id, "submit");
    await ev.eventTransition(sk, id, "approve");
    tt = (await ev.getEvent(a, id))!.tickets[0].id;
    const r = await reg(a, id, tt, "An");
    regA = r.registrationId;
    payUrlA = r.payUrl!;
    expect(payUrlA).toContain("vnp_Amount=10000000");
    await expect(reg(b, id, tt)).rejects.toThrow(/đã hết/); // seat held
    expect((await ev.getTicket(a, regA))?.status).toBe("pending_payment");

    const forged = { ...vnpayReturn(payUrlA), vnp_Amount: "100" };
    expect((await pay.handleVnpay(forged, "return")).code).toBe("invalid_signature");
    expect((await pay.handleVnpay(vnpayReturn(payUrlA, "00", 100), "ipn")).code).toBe("invalid_amount");

    const ok = await pay.handleVnpay(vnpayReturn(payUrlA), "ipn");
    expect(ok).toMatchObject({ code: "ok", success: true, returnPath: `/events/tickets/${regA}` });
    expect((await pay.handleVnpay(vnpayReturn(payUrlA), "return")).code).toBe("already");
    expect(await ev.getTicket(a, regA)).toMatchObject({ status: "confirmed", paid: true });
    expect((await ev.dashboard(org, id)).revenueOnline).toBe(100000);
  });
  it("a failed payment releases the seat", async () => {
    const id2 = await ev.createEvent(sk, base({ title: "Hội thảo thất bại thanh toán", tickets: [{ name: "Vé", price: 20000, capacity: 1 }] }));
    await ev.eventTransition(sk, id2, "submit");
    const t2 = (await ev.getEvent(b, id2))!.tickets[0].id;
    const r = await reg(b, id2, t2);
    expect((await pay.handleVnpay(vnpayReturn(r.payUrl!, "24"), "return")).success).toBe(false);
    expect((await ev.getTicket(b, r.registrationId))?.status).toBe("cancelled");
    expect((await reg(c, id2, t2)).payUrl).toBeTruthy();
  });
  it("refund request → organizer approves → VNPAY unreachable → staff finish by hand", async () => {
    await expect(pay.requestRefund(b, { refType: "evt_registration", refId: regA, reason: "cannot_attend", details: "Tôi bận việc gia đình" })).rejects.toThrow(/đã thanh toán/);
    const rid = await pay.requestRefund(a, { refType: "evt_registration", refId: regA, reason: "cannot_attend", details: "Tôi bận việc gia đình" });
    await expect(pay.requestRefund(a, { refType: "evt_registration", refId: regA, reason: "other", details: "Gửi lại lần nữa nhé" })).rejects.toThrow(/Đã có yêu cầu/);
    await expect(pay.decideRefund(b, rid, true)).rejects.toThrow(/bên nhận tiền/);
    await expect(pay.decideRefund(org, rid, false)).rejects.toThrow(/lý do/);
    expect(await pay.decideRefund(org, rid, true)).toBe("processing");
    await expect(pay.markRefunded(org, rid, "FT123")).rejects.toThrow();
    await pay.markRefunded(boss, rid, "FT26112012345");
    expect((await ev.getTicket(a, regA))?.status).toBe("refunded");
    expect((await one<{ status: string }>("SELECT status FROM payments WHERE id = (SELECT payment_id FROM refunds WHERE id = ?)", [rid]))?.status).toBe("refunded");
  });
  it("cancelling an event refunds every paid ticket automatically (VNPAY accepts)", async () => {
    const id3 = await ev.createEvent(sk, base({ title: "Sự kiện sẽ bị hủy", tickets: [{ name: "Vé", price: 30000, capacity: null }, { name: "Free", price: 0, capacity: null }] }));
    await ev.eventTransition(sk, id3, "submit");
    const [paid, free] = (await ev.getEvent(c, id3))!.tickets;
    const rc = await reg(c, id3, paid.id, "Chi");
    await pay.handleVnpay(vnpayReturn(rc.payUrl!), "ipn");
    const ra = await reg(a, id3, free.id, "An");
    vi.stubGlobal("fetch", vi.fn(async () => new Response(JSON.stringify({ vnp_ResponseCode: "00" }), { status: 200 })));
    try {
      await expect(ev.eventTransition(sk, id3, "cancel")).rejects.toThrow(/lý do/);
      expect(await ev.eventTransition(sk, id3, "cancel", "Diễn giả ốm")).toBe("cancelled");
    } finally {
      vi.unstubAllGlobals();
    }
    expect((await ev.getTicket(c, rc.registrationId))?.status).toBe("refunded");
    expect((await ev.getTicket(a, ra.registrationId))?.status).toBe("cancelled");
  });
  it("payouts only include released (completed) items", async () => {
    const bal = await pay.payeeBalance(org.id);
    expect(bal.available).toBe(0);
    expect(bal.held).toBe(0); // the only ticket was refunded
  });
});

describe("refund after check-in", () => {
  it("a checked-in ticket cannot be refunded", async () => {
    const id = await ev.createEvent(sk, base({ title: "Sự kiện check-in rồi", tickets: [{ name: "Vé", price: 40000, capacity: null }] }));
    await ev.eventTransition(sk, id, "submit");
    const tt = (await ev.getEvent(b, id))!.tickets[0].id;
    const r = await reg(b, id, tt, "Bình");
    await pay.handleVnpay(vnpayReturn(r.payUrl!), "ipn");
    const t = await ev.getTicket(b, r.registrationId);
    await ev.checkIn(sk, id, t!.ticketCode);
    await expect(pay.requestRefund(b, { refType: "evt_registration", refId: r.registrationId, reason: "cannot_attend", details: "Đổi ý không muốn đi nữa" })).rejects.toThrow(/check-in/);
  });
});

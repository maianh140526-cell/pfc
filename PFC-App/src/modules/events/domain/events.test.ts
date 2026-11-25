import { describe, expect, it } from "vitest";
import { applyEventAction, availableEventActions, parseTicket, registrationOpen, ticketPayload, validateSchedule, validateTickets, vnLocal } from "./events";

const org = { isOrganizer: true, canApprove: false };
const appr = { isOrganizer: false, canApprove: true };

describe("event rules", () => {
  it("lifecycle and approval", () => {
    expect(applyEventAction("submit", "draft", org)).toEqual({ ok: true, to: "submitted" });
    expect(applyEventAction("submit", "draft", { ...org, canApprove: true })).toEqual({ ok: true, to: "published" });
    expect(applyEventAction("approve", "submitted", org).ok).toBe(false);
    expect(applyEventAction("reject", "submitted", appr).ok).toBe(false);
    expect(applyEventAction("reject", "submitted", appr, "Thiếu địa điểm")).toEqual({ ok: true, to: "rejected" });
    expect(applyEventAction("cancel", "published", org).ok).toBe(false);
    expect(applyEventAction("cancel", "published", org, "Mưa bão")).toEqual({ ok: true, to: "cancelled" });
    expect(availableEventActions("published", { isOrganizer: false, canApprove: false })).toEqual([]);
  });
  it("schedule and tickets", () => {
    expect(vnLocal(new Date("2026-11-20T17:30:00Z"))).toBe("2026-11-21T00:30");
    expect(validateSchedule("2026-12-01T09:00", "2026-12-01T08:00", null, "2026-11-20T00:00")).toMatch(/sau thời gian bắt đầu/);
    expect(validateSchedule("2026-11-01T09:00", "2026-11-01T10:00", null, "2026-11-20T00:00")).toMatch(/tương lai/);
    expect(validateSchedule("2026-12-01T09:00", "2026-12-01T11:00", "2026-12-02T00:00", "2026-11-20T00:00")).toMatch(/Hạn đăng ký/);
    expect(validateSchedule("2026-12-01T09:00", "2026-12-01T11:00", "2026-11-30T23:00", "2026-11-20T00:00")).toBeNull();
    expect(validateTickets([])).toMatch(/ít nhất một/);
    expect(validateTickets([{ name: "Thường", price: 1000, capacity: null }])).toMatch(/5.000/);
    expect(validateTickets([{ name: "A", price: 0, capacity: 0 }])).toMatch(/từ 1/);
    expect(validateTickets([{ name: "A", price: 0, capacity: null }, { name: "a", price: 10000, capacity: 5 }])).toMatch(/trùng/);
    expect(validateTickets([{ name: "Sinh viên", price: 100000, capacity: 50 }])).toBeNull();
  });
  it("registration window", () => {
    const e = { status: "published" as const, startsAt: "2026-12-01T09:00", deadline: null };
    expect(registrationOpen(e, "2026-11-30T00:00")).toBeNull();
    expect(registrationOpen(e, "2026-12-01T09:00")).toMatch(/hết hạn/);
    expect(registrationOpen({ ...e, status: "draft" }, "2026-11-30T00:00")).toMatch(/chưa mở/);
  });
  it("ticket QR payload", () => {
    expect(parseTicket(ticketPayload("ABCDEF123456"))).toBe("ABCDEF123456");
    expect(parseTicket("abcdef123456")).toBe("ABCDEF123456");
    expect(parseTicket("PFC-EVT:short")).toBeNull();
    expect(parseTicket("<script>")).toBeNull();
  });
});

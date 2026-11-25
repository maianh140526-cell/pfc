import { describe, expect, it } from "vitest";
import { applyOrderAction, availableActions, averageRating, canReview, cartProblems, orderCode, splitCart, type OrderState } from "./orders";

const cod: OrderState = { status: "placed", paymentMethod: "cod", paymentStatus: "unpaid" };
const bank: OrderState = { status: "placed", paymentMethod: "bank_transfer", paymentStatus: "unpaid" };

describe("order lifecycle", () => {
  it("happy path for COD: confirm → ship → deliver → buyer completes (paid at hand-over)", () => {
    const c = applyOrderAction(cod, "confirm", "seller");
    expect(c).toMatchObject({ ok: true, status: "confirmed" });
    const s = applyOrderAction({ ...cod, status: "confirmed" }, "ship", "seller");
    expect(s).toMatchObject({ ok: true, status: "shipping" });
    const d = applyOrderAction({ ...cod, status: "shipping" }, "deliver", "seller");
    expect(d).toMatchObject({ ok: true, status: "delivered" });
    expect(applyOrderAction({ ...cod, status: "delivered" }, "complete", "buyer")).toEqual({ ok: true, status: "completed", paymentStatus: "paid" });
  });
  it("bank transfer cannot ship before the seller confirms payment", () => {
    expect(applyOrderAction({ ...bank, status: "confirmed" }, "ship", "seller").ok).toBe(false);
    const paid = applyOrderAction({ ...bank, status: "confirmed" }, "mark_paid", "seller");
    expect(paid).toMatchObject({ ok: true, paymentStatus: "paid" });
    expect(applyOrderAction({ ...bank, status: "confirmed", paymentStatus: "paid" }, "ship", "seller").ok).toBe(true);
  });
  it("roles cannot do each other's steps", () => {
    expect(applyOrderAction(cod, "confirm", "buyer").ok).toBe(false);
    expect(applyOrderAction({ ...cod, status: "delivered" }, "complete", "seller").ok).toBe(false);
    expect(applyOrderAction(cod, "mark_paid", "buyer").ok).toBe(false);
  });
  it("cancellation: buyer only while placed; seller with a reason until shipped", () => {
    expect(applyOrderAction(cod, "cancel", "buyer").ok).toBe(true);
    expect(applyOrderAction({ ...cod, status: "confirmed" }, "cancel", "buyer").ok).toBe(false);
    expect(applyOrderAction({ ...cod, status: "confirmed" }, "cancel", "seller").ok).toBe(false);
    expect(applyOrderAction({ ...cod, status: "confirmed" }, "cancel", "seller", "Hết hàng").ok).toBe(true);
    expect(applyOrderAction({ ...cod, status: "shipping" }, "cancel", "seller", "x").ok).toBe(false);
  });
  it("lists only valid actions per role", () => {
    expect(availableActions(cod, "seller")).toEqual(["confirm", "mark_paid", "cancel"]);
    expect(availableActions(cod, "buyer")).toEqual(["cancel"]);
    expect(availableActions({ ...cod, status: "completed", paymentStatus: "paid" }, "buyer")).toEqual([]);
  });
  it("reviews only after completion", () => {
    expect(canReview("delivered")).toBe(false);
    expect(canReview("completed")).toBe(true);
  });
});

describe("cart", () => {
  const line = (listingId: string, sellerId: string, price: number, qty: number, stock: number | null = null, available = true) => ({
    listingId,
    sellerId,
    title: listingId,
    price,
    qty,
    stock,
    available,
  });
  it("splits by seller with server-side totals", () => {
    const orders = splitCart([line("a", "s1", 100, 2), line("b", "s2", 50, 1), line("c", "s1", 10, 3)]);
    expect(orders).toHaveLength(2);
    expect(orders.find((o) => o.sellerId === "s1")?.total).toBe(230);
  });
  it("flags unavailable items and insufficient stock", () => {
    expect(cartProblems([line("a", "s", 1, 3, 2), line("b", "s", 1, 1, null, false), line("c", "s", 1, 1, 5)])).toHaveLength(2);
  });
});

describe("helpers", () => {
  it("formats order codes in Vietnam date", () => {
    expect(orderCode(new Date("2026-11-19T18:00:00Z"), "k3q7zz")).toBe("PFC261120-K3Q7");
  });
  it("averages ratings to one decimal", () => {
    expect(averageRating([5, 4, 4])).toBe(4.3);
    expect(averageRating([])).toBeNull();
  });
});

describe("VNPAY orders", () => {
  it("cannot be confirmed before payment, never marked paid by hand, keep paid on completion", async () => {
    const { applyOrderAction } = await import("./orders");
    const unpaid = { status: "placed" as const, paymentMethod: "vnpay" as const, paymentStatus: "unpaid" as const };
    expect(applyOrderAction(unpaid, "confirm", "seller").ok).toBe(false);
    expect(applyOrderAction(unpaid, "mark_paid", "seller").ok).toBe(false);
    expect(applyOrderAction(unpaid, "cancel", "buyer")).toMatchObject({ ok: true, status: "cancelled" });
    const paid = { ...unpaid, paymentStatus: "paid" as const };
    expect(applyOrderAction(paid, "confirm", "seller")).toMatchObject({ ok: true, status: "confirmed" });
    expect(applyOrderAction({ ...paid, status: "delivered" }, "complete", "buyer")).toMatchObject({ ok: true, paymentStatus: "paid" });
  });
});

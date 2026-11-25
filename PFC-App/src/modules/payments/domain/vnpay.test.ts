import { describe, expect, it } from "vitest";
import { asciiInfo, buildPaymentUrl, buildRefundRequest, feeFor, hmac512, signData, verifyResult, vnpDate, vnpayConfig } from "./vnpay";

const CFG = vnpayConfig({ VNPAY_TMN_CODE: "TESTCODE", VNPAY_HASH_SECRET: "SECRETKEYSECRETKEY" })!;

describe("VNPAY signing", () => {
  it("is off until both merchant code and secret exist; defaults to sandbox", () => {
    expect(vnpayConfig({ VNPAY_TMN_CODE: "x" })).toBeNull();
    expect(CFG.payUrl).toMatch(/^https:\/\/sandbox\.vnpayment\.vn\//);
  });
  it("sorts keys and encodes spaces as +", () => {
    expect(signData({ vnp_b: "a b", vnp_a: "x/y", vnp_empty: "" })).toBe("vnp_a=x%2Fy&vnp_b=a+b");
  });
  it("formats dates in Vietnam time", () => {
    expect(vnpDate(new Date("2026-11-20T17:30:05Z"))).toBe("20261121003005");
  });
  it("strips Vietnamese accents from order info", () => {
    expect(asciiInfo("Thanh toán đơn hàng #PFC-01 – Sách")).toBe("Thanh toan don hang #PFC-01  Sach");
  });
  it("builds a signed URL that verifies, and rejects tampering", () => {
    const url = new URL(
      buildPaymentUrl(CFG, {
        txnRef: "abc123",
        amount: 85000,
        orderInfo: "Thanh toán đơn hàng",
        ipAddr: "1.2.3.4",
        returnUrl: "http://localhost:3200/api/payments/vnpay/return",
        createdAt: new Date("2026-11-20T03:00:00Z"),
        expiresAt: new Date("2026-11-20T03:15:00Z"),
      }),
    );
    expect(url.searchParams.get("vnp_Amount")).toBe("8500000");
    expect(url.searchParams.get("vnp_ExpireDate")).toBe("20261120101500");
    // Simulate VNPAY's return: its fields + its own hash over them.
    const back: Record<string, string> = { vnp_TmnCode: "TESTCODE", vnp_TxnRef: "abc123", vnp_Amount: "8500000", vnp_ResponseCode: "00", vnp_TransactionStatus: "00", vnp_TransactionNo: "14000001", vnp_BankCode: "NCB", vnp_OrderInfo: "Thanh toan don hang", vnp_PayDate: "20261120100512" };
    back.vnp_SecureHash = hmac512(signData(back), CFG.hashSecret);
    const ok = verifyResult(CFG, back);
    expect(ok).toMatchObject({ valid: true, success: true, amount: 85000, txnRef: "abc123", transactionNo: "14000001" });
    expect(verifyResult(CFG, { ...back, vnp_Amount: "100" }).valid).toBe(false);
    expect(verifyResult(CFG, { ...back, vnp_SecureHash: back.vnp_SecureHash.toUpperCase() }).valid).toBe(true);
    const cancelled: Record<string, string> = { ...back, vnp_ResponseCode: "24" };
    cancelled.vnp_SecureHash = hmac512(signData(Object.fromEntries(Object.entries(cancelled).filter(([k]) => k !== "vnp_SecureHash"))), CFG.hashSecret);
    expect(verifyResult(CFG, cancelled)).toMatchObject({ valid: true, success: false, responseCode: "24" });
    const otherMerchant: Record<string, string> = { ...back, vnp_TmnCode: "OTHER" };
    otherMerchant.vnp_SecureHash = hmac512(signData(Object.fromEntries(Object.entries(otherMerchant).filter(([k]) => k !== "vnp_SecureHash"))), CFG.hashSecret);
    expect(verifyResult(CFG, otherMerchant).valid).toBe(false);
  });
  it("rejects non-integer or non-positive amounts", () => {
    const base = { txnRef: "x", orderInfo: "", ipAddr: "", returnUrl: "", createdAt: new Date(), expiresAt: new Date() };
    expect(() => buildPaymentUrl(CFG, { ...base, amount: 0 })).toThrow();
    expect(() => buildPaymentUrl(CFG, { ...base, amount: 10.5 })).toThrow();
  });
  it("signs refund requests with the pipe-joined field order", () => {
    const r = buildRefundRequest(CFG, { requestId: "r1", txnRef: "abc123", amount: 85000, full: true, transactionNo: "14000001", transactionDate: "20261120100000", createBy: "Chủ nhiệm", createdAt: new Date("2026-11-21T01:00:00Z"), ipAddr: "1.2.3.4", orderInfo: "Hoàn tiền" });
    const data = ["r1", "2.1.0", "refund", "TESTCODE", "02", "abc123", "8500000", "14000001", "20261120100000", "Chu nhiem", "20261121080000", "1.2.3.4", "Hoan tien"].join("|");
    expect(r.vnp_SecureHash).toBe(hmac512(data, CFG.hashSecret));
  });
  it("platform fee defaults to zero", () => {
    expect(feeFor(100000, 0)).toBe(0);
    expect(feeFor(100000, 250)).toBe(2500);
    expect(feeFor(99, 250)).toBe(2);
  });
});

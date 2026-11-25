import { createHmac, timingSafeEqual } from "node:crypto";

/**
 * VNPAY payment gateway v2.1.0 (pure helpers, unit tested).
 * Signing follows VNPAY's integration guide: parameters sorted by key, values URL-encoded with spaces
 * as "+", joined "k=v&…", HMAC-SHA512 with the merchant hash secret, hex.
 */
export type VnpayConfig = { tmnCode: string; hashSecret: string; payUrl: string; apiUrl: string };

export const SANDBOX_PAY_URL = "https://sandbox.vnpayment.vn/paymentv2/vpcpay.html";
export const SANDBOX_API_URL = "https://sandbox.vnpayment.vn/merchant_webapi/api/transaction";

export function vnpayConfig(env: Record<string, string | undefined>): VnpayConfig | null {
  const tmnCode = env.VNPAY_TMN_CODE?.trim();
  const hashSecret = env.VNPAY_HASH_SECRET?.trim();
  if (!tmnCode || !hashSecret) return null;
  return { tmnCode, hashSecret, payUrl: env.VNPAY_PAY_URL?.trim() || SANDBOX_PAY_URL, apiUrl: env.VNPAY_API_URL?.trim() || SANDBOX_API_URL };
}

const enc = (v: string) => encodeURIComponent(v).replace(/%20/g, "+");

/** "k=v&k2=v2" with keys sorted and values encoded the way VNPAY signs them. */
export function signData(params: Record<string, string>): string {
  return Object.keys(params)
    .filter((k) => params[k] !== undefined && params[k] !== "")
    .sort()
    .map((k) => `${encodeURIComponent(k)}=${enc(params[k])}`)
    .join("&");
}

export const hmac512 = (data: string, secret: string) => createHmac("sha512", secret).update(Buffer.from(data, "utf-8")).digest("hex");

/** yyyyMMddHHmmss in Vietnam time (GMT+7), as VNPAY expects. */
export function vnpDate(d: Date): string {
  const t = new Date(d.getTime() + 7 * 3600_000);
  const p = (n: number) => String(n).padStart(2, "0");
  return `${t.getUTCFullYear()}${p(t.getUTCMonth() + 1)}${p(t.getUTCDate())}${p(t.getUTCHours())}${p(t.getUTCMinutes())}${p(t.getUTCSeconds())}`;
}

/** VNPAY asks for unaccented order info; keep it short and printable. */
export function asciiInfo(s: string): string {
  return s
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/đ/g, "d")
    .replace(/Đ/g, "D")
    .replace(/[^\x20-\x7E]/g, "")
    .slice(0, 200);
}

export function buildPaymentUrl(
  cfg: VnpayConfig,
  p: { txnRef: string; amount: number; orderInfo: string; ipAddr: string; returnUrl: string; createdAt: Date; expiresAt: Date; bankCode?: string },
): string {
  if (!Number.isInteger(p.amount) || p.amount <= 0) throw new Error("amount must be a positive integer (VND)");
  const params: Record<string, string> = {
    vnp_Version: "2.1.0",
    vnp_Command: "pay",
    vnp_TmnCode: cfg.tmnCode,
    vnp_Amount: String(p.amount * 100),
    vnp_CurrCode: "VND",
    vnp_TxnRef: p.txnRef,
    vnp_OrderInfo: asciiInfo(p.orderInfo),
    vnp_OrderType: "other",
    vnp_Locale: "vn",
    vnp_ReturnUrl: p.returnUrl,
    vnp_IpAddr: p.ipAddr || "127.0.0.1",
    vnp_CreateDate: vnpDate(p.createdAt),
    vnp_ExpireDate: vnpDate(p.expiresAt),
  };
  if (p.bankCode) params.vnp_BankCode = p.bankCode;
  const data = signData(params);
  return `${cfg.payUrl}?${data}&vnp_SecureHash=${hmac512(data, cfg.hashSecret)}`;
}

export type VnpayResult = {
  valid: boolean;
  txnRef: string;
  amount: number;
  success: boolean;
  responseCode: string;
  transactionNo: string | null;
  bankCode: string | null;
  cardType: string | null;
  payDate: string | null;
};

/** Verifies a Return URL / IPN query. Only vnp_* params are signed; the hash itself is excluded. */
export function verifyResult(cfg: VnpayConfig, query: Record<string, string>): VnpayResult {
  const params: Record<string, string> = {};
  for (const [k, v] of Object.entries(query)) if (k.startsWith("vnp_") && k !== "vnp_SecureHash" && k !== "vnp_SecureHashType") params[k] = v;
  const given = (query.vnp_SecureHash ?? "").toLowerCase();
  const expected = hmac512(signData(params), cfg.hashSecret);
  const valid = given.length === expected.length && timingSafeEqual(Buffer.from(given), Buffer.from(expected)) && params.vnp_TmnCode === cfg.tmnCode;
  const amountRaw = Number(params.vnp_Amount ?? 0);
  return {
    valid,
    txnRef: params.vnp_TxnRef ?? "",
    amount: Number.isFinite(amountRaw) ? Math.round(amountRaw / 100) : 0,
    success: params.vnp_ResponseCode === "00" && (params.vnp_TransactionStatus ?? "00") === "00",
    responseCode: params.vnp_ResponseCode ?? "",
    transactionNo: params.vnp_TransactionNo ?? null,
    bankCode: params.vnp_BankCode ?? null,
    cardType: params.vnp_CardType ?? null,
    payDate: params.vnp_PayDate ?? null,
  };
}

/** Human message for common VNPAY response codes (shown on the result page). */
export function responseMessage(code: string): string {
  const m: Record<string, string> = {
    "00": "Giao dịch thành công.",
    "07": "Giao dịch bị nghi ngờ gian lận, đang chờ ngân hàng xác minh.",
    "09": "Thẻ/tài khoản chưa đăng ký Internet Banking.",
    "10": "Xác thực thông tin thẻ/tài khoản sai quá 3 lần.",
    "11": "Hết thời gian chờ thanh toán.",
    "12": "Thẻ/tài khoản bị khóa.",
    "13": "Sai mật khẩu xác thực giao dịch (OTP).",
    "24": "Bạn đã hủy giao dịch.",
    "51": "Tài khoản không đủ số dư.",
    "65": "Vượt hạn mức giao dịch trong ngày.",
    "75": "Ngân hàng đang bảo trì.",
    "79": "Nhập sai mật khẩu thanh toán quá số lần quy định.",
  };
  return m[code] ?? "Giao dịch không thành công.";
}

/** Body for the VNPAY refund API (vnp_Command=refund). Pipe-joined hash per the API guide. */
export function buildRefundRequest(
  cfg: VnpayConfig,
  r: { requestId: string; txnRef: string; amount: number; full: boolean; transactionNo: string; transactionDate: string; createBy: string; createdAt: Date; ipAddr: string; orderInfo: string },
): Record<string, string> {
  const body: Record<string, string> = {
    vnp_RequestId: r.requestId,
    vnp_Version: "2.1.0",
    vnp_Command: "refund",
    vnp_TmnCode: cfg.tmnCode,
    vnp_TransactionType: r.full ? "02" : "03",
    vnp_TxnRef: r.txnRef,
    vnp_Amount: String(r.amount * 100),
    vnp_TransactionNo: r.transactionNo,
    vnp_TransactionDate: r.transactionDate,
    vnp_CreateBy: asciiInfo(r.createBy).slice(0, 100),
    vnp_CreateDate: vnpDate(r.createdAt),
    vnp_IpAddr: r.ipAddr || "127.0.0.1",
    vnp_OrderInfo: asciiInfo(r.orderInfo),
  };
  const data = [
    body.vnp_RequestId,
    body.vnp_Version,
    body.vnp_Command,
    body.vnp_TmnCode,
    body.vnp_TransactionType,
    body.vnp_TxnRef,
    body.vnp_Amount,
    body.vnp_TransactionNo,
    body.vnp_TransactionDate,
    body.vnp_CreateBy,
    body.vnp_CreateDate,
    body.vnp_IpAddr,
    body.vnp_OrderInfo,
  ].join("|");
  return { ...body, vnp_SecureHash: hmac512(data, cfg.hashSecret) };
}

/** Platform fee in basis points (env PFC_PLATFORM_FEE_BPS, default 0 — no fee until PFC decides one). */
export function feeFor(amount: number, bps: number): number {
  if (!Number.isFinite(bps) || bps <= 0) return 0;
  return Math.floor((amount * Math.min(bps, 5000)) / 10_000);
}

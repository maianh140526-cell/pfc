import type { PaymentStatus, RefundStatus } from "../server/service";

export const PAY_TONE: Record<PaymentStatus, "income" | "warning" | "expense" | "muted" | "primary"> = {
  pending: "warning",
  succeeded: "income",
  failed: "expense",
  expired: "muted",
  refunded: "primary",
  partially_refunded: "primary",
};
export const REFUND_TONE: Record<RefundStatus, "income" | "warning" | "expense" | "muted" | "primary"> = {
  requested: "warning",
  approved: "primary",
  rejected: "expense",
  processing: "warning",
  refunded: "income",
};

export const vnTime = (iso: string) => new Date(iso).toLocaleString("vi-VN", { timeZone: "Asia/Ho_Chi_Minh", hour: "2-digit", minute: "2-digit", day: "2-digit", month: "2-digit", year: "numeric" });

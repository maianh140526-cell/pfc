import "server-only";
import type { Actor } from "@/platform/roles";

/**
 * What a paid thing (order, event registration) must answer so the payments module can run without
 * knowing each module's tables. Loaded lazily to avoid import cycles (market/events also call payments).
 */
export type PaymentHooks = {
  /** Mark the item paid (idempotent). */
  onPaid(refId: string, paymentId: string): Promise<void>;
  /** Payment failed / expired / cancelled: release stock or seat (idempotent). */
  onFailed(refId: string): Promise<void>;
  /** Money returned to the payer. */
  onRefunded(refId: string): Promise<void>;
  /** May this actor ask for a refund on this item? Payee is who receives / approves. */
  refundCheck(actor: Actor, refId: string): Promise<{ ok: true; payeeId: string; amount: number } | { ok: false; error: string }>;
  /** Item may be paid out to the payee (order completed, event finished). */
  releasable(refId: string): Promise<boolean>;
  describe(refId: string): Promise<{ title: string; href: string }>;
};

export type RefType = "mkt_order" | "evt_registration";
export const REF_LABEL: Record<RefType, string> = { mkt_order: "Đơn hàng", evt_registration: "Vé sự kiện" };
export const isRefType = (v: unknown): v is RefType => v === "mkt_order" || v === "evt_registration";

export async function hooksFor(ref: RefType): Promise<PaymentHooks> {
  if (ref === "mkt_order") return (await import("@/modules/market/server/payment-hooks")).hooks;
  return (await import("@/modules/events/server/payment-hooks")).hooks;
}

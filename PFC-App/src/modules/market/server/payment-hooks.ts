import "server-only";
import { randomUUID } from "node:crypto";
import { one, run } from "@/platform/db/client";
import { notify } from "@/platform/notifications/service";
import type { PaymentHooks } from "@/modules/payments/server/hooks";
import { releaseUnpaidVnpay } from "./service";

const now = () => new Date().toISOString();

async function order(id: string) {
  return one<{ id: string; code: string; buyer_id: string; seller_id: string; status: string; payment_method: string; payment_status: string; total: number }>(
    "SELECT id, code, buyer_id, seller_id, status, payment_method, payment_status, total FROM mkt_orders WHERE id = ?",
    [id],
  );
}

/** How the payments module talks to Marketplace orders (ref_type "mkt_order"). */
export const hooks: PaymentHooks = {
  async onPaid(orderId) {
    const n = await run("UPDATE mkt_orders SET payment_status = 'paid', payment_due_at = NULL, updated_at = ? WHERE id = ? AND payment_status = 'unpaid'", [now(), orderId]);
    if (n !== 1) return;
    await run("INSERT INTO mkt_order_events (id, order_id, actor_id, from_status, to_status, note, created_at) VALUES (?, ?, 'system', NULL, 'paid', 'VNPAY', ?)", [randomUUID(), orderId, now()]);
    const o = await order(orderId);
    if (o) await notify(o.seller_id, { category: "market", title: `Đơn hàng mới #${o.code} (đã thanh toán)`, body: "Vào Đơn bán để xác nhận đơn.", href: `/market/orders/${orderId}` });
  },
  async onFailed(orderId) {
    const n = await run(
      "UPDATE mkt_orders SET status = 'cancelled', cancel_reason = 'Chưa thanh toán trực tuyến', updated_at = ? WHERE id = ? AND status = 'placed' AND payment_method = 'vnpay' AND payment_status = 'unpaid'",
      [now(), orderId],
    );
    if (n !== 1) return;
    await run("INSERT INTO mkt_order_events (id, order_id, actor_id, from_status, to_status, note, created_at) VALUES (?, ?, 'system', 'placed', 'cancelled', 'Chưa thanh toán', ?)", [randomUUID(), orderId, now()]);
    await releaseUnpaidVnpay(orderId);
  },
  async onRefunded(orderId) {
    await run("UPDATE mkt_orders SET payment_status = 'refunded', updated_at = ? WHERE id = ?", [now(), orderId]);
    await run("INSERT INTO mkt_order_events (id, order_id, actor_id, from_status, to_status, note, created_at) VALUES (?, ?, 'system', NULL, 'refunded', NULL, ?)", [randomUUID(), orderId, now()]);
  },
  async refundCheck(actor, orderId) {
    const o = await order(orderId);
    if (!o || o.buyer_id !== actor.id) return { ok: false, error: "Không tìm thấy đơn hàng." };
    if (o.payment_method !== "vnpay" || o.payment_status !== "paid") return { ok: false, error: "Đơn chưa được thanh toán trực tuyến." };
    if (o.status === "cancelled") return { ok: false, error: "Đơn đã hủy: tiền được hoàn tự động." };
    return { ok: true, payeeId: o.seller_id, amount: Number(o.total) };
  },
  async releasable(orderId) {
    return (await order(orderId))?.status === "completed";
  },
  async describe(orderId) {
    const o = await order(orderId);
    return { title: o ? `Đơn hàng #${o.code}` : "Đơn hàng", href: `/market/orders/${orderId}` };
  },
};

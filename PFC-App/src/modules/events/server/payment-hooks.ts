import "server-only";
import { one, run } from "@/platform/db/client";
import { notify } from "@/platform/notifications/service";
import type { PaymentHooks } from "@/modules/payments/server/hooks";
import { vnLocal } from "../domain/events";

const now = () => new Date().toISOString();

async function reg(id: string) {
  return one<{ id: string; member_id: string; status: string; price: number; paid: number; checked_in_at: string | null; event_id: string; title: string; organizer_id: string; starts_at: string; ends_at: string; event_status: string }>(
    `SELECT r.id, r.member_id, r.status, r.price, r.paid, r.checked_in_at, r.event_id, e.title, e.organizer_id, e.starts_at, e.ends_at, e.status AS event_status
     FROM evt_registrations r JOIN evt_events e ON e.id = r.event_id WHERE r.id = ?`,
    [id],
  );
}

/** How the payments module talks to event registrations (ref_type "evt_registration"). */
export const hooks: PaymentHooks = {
  async onPaid(regId, paymentId) {
    // Paid within VNPAY's window: confirm even if the 15-minute hold just lapsed (the seat was still counted).
    let n = 0;
    try {
      n = await run(
        "UPDATE evt_registrations SET status = 'confirmed', paid = 1, payment_id = ?, hold_until = NULL, updated_at = ? WHERE id = ? AND status IN ('pending_payment','cancelled') AND paid = 0",
        [paymentId, now(), regId],
      );
    } catch {
      // The member re-registered meanwhile (unique active registration): keep that one and refund this payment.
      await run("UPDATE evt_registrations SET paid = 1, payment_id = ?, updated_at = ? WHERE id = ?", [paymentId, now(), regId]);
      const { autoRefund } = await import("@/modules/payments/server/service");
      await autoRefund("evt_registration", regId, "duplicate", "system");
      return;
    }
    if (n !== 1) return;
    const r = await reg(regId);
    if (!r) return;
    await notify(r.member_id, { category: "events", title: `Đã có vé: ${r.title.slice(0, 60)}`, body: "Mở vé để xem mã QR check-in.", href: `/events/tickets/${regId}` });
    await notify(r.organizer_id, { category: "events", title: `Có người mua vé “${r.title.slice(0, 50)}”`, href: `/events/${r.event_id}/manage`, dedupeKey: `evt-reg:${regId}` });
  },
  async onFailed(regId) {
    await run("UPDATE evt_registrations SET status = 'cancelled', cancel_reason = 'Chưa thanh toán', updated_at = ? WHERE id = ? AND status = 'pending_payment'", [now(), regId]);
  },
  async onRefunded(regId) {
    await run("UPDATE evt_registrations SET status = 'refunded', updated_at = ? WHERE id = ?", [now(), regId]);
  },
  async refundCheck(actor, regId) {
    const r = await reg(regId);
    if (!r || r.member_id !== actor.id) return { ok: false, error: "Không tìm thấy vé." };
    if (r.status !== "confirmed" || !Number(r.paid)) return { ok: false, error: "Vé chưa được thanh toán trực tuyến." };
    if (r.checked_in_at) return { ok: false, error: "Vé đã check-in nên không hoàn tiền được." };
    if (r.ends_at < vnLocal(new Date())) return { ok: false, error: "Sự kiện đã kết thúc." };
    return { ok: true, payeeId: r.organizer_id, amount: Number(r.price) };
  },
  async releasable(regId) {
    const r = await reg(regId);
    return !!r && r.event_status === "completed";
  },
  async describe(regId) {
    const r = await reg(regId);
    return { title: r ? `Vé “${r.title}”` : "Vé sự kiện", href: `/events/tickets/${regId}` };
  },
};

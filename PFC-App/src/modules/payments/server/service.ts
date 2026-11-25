import "server-only";
import { randomBytes, randomUUID } from "node:crypto";
import { z } from "zod";
import { all, one, run } from "@/platform/db/client";
import { audit } from "@/platform/audit";
import { ActionError } from "@/platform/errors";
import { publicUrl } from "@/platform/mail";
import { notify } from "@/platform/notifications/service";
import { can, type Actor } from "@/platform/roles";
import { buildPaymentUrl, buildRefundRequest, feeFor, responseMessage, verifyResult, vnpDate, vnpayConfig } from "../domain/vnpay";
import { REF_LABEL, hooksFor, isRefType, type RefType } from "./hooks";

/**
 * Payments (G5). PFC receives online payments through its VNPAY merchant account, records what it owes each
 * payee (payment_items), and pays sellers / organizers out after the order completes or the event ends.
 * Results are applied idempotently from either the browser Return URL or VNPAY's IPN — both are HMAC-signed.
 */
const now = () => new Date().toISOString();
export const PAYMENT_TTL_MIN = 15;

export type PaymentStatus = "pending" | "succeeded" | "failed" | "expired" | "refunded" | "partially_refunded";
export const PAYMENT_STATUS_LABEL: Record<PaymentStatus, string> = {
  pending: "Đang chờ thanh toán",
  succeeded: "Đã thanh toán",
  failed: "Thất bại",
  expired: "Hết hạn",
  refunded: "Đã hoàn tiền",
  partially_refunded: "Hoàn tiền một phần",
};

export const onlinePaymentEnabled = () => !!vnpayConfig(process.env);
const feeBps = () => Number(process.env.PFC_PLATFORM_FEE_BPS ?? 0);

async function event(paymentId: string, kind: string, detail: Record<string, unknown> = {}) {
  await run("INSERT INTO payment_events (id, payment_id, kind, detail, created_at) VALUES (?, ?, ?, ?, ?)", [randomUUID(), paymentId, kind, JSON.stringify(detail), now()]);
}

export type PaymentItemInput = { refType: RefType; refId: string; payeeId: string; amount: number };

/** PAY-01 Creates a pending payment and the VNPAY URL to send the payer to. */
export async function createPayment(
  payerId: string,
  p: { purpose: string; description: string; returnPath: string; items: PaymentItemInput[]; ipAddr: string },
): Promise<{ id: string; payUrl: string; expiresAt: string }> {
  const cfg = vnpayConfig(process.env);
  if (!cfg) throw new ActionError("Thanh toán trực tuyến chưa được bật trên máy chủ.", "payments_off");
  const amount = p.items.reduce((s, i) => s + i.amount, 0);
  if (!Number.isInteger(amount) || amount <= 0) throw new ActionError("Số tiền thanh toán không hợp lệ.");
  if (amount < 5_000) throw new ActionError("VNPAY yêu cầu tối thiểu 5.000₫ mỗi giao dịch.");
  const created = new Date();
  const expires = new Date(created.getTime() + PAYMENT_TTL_MIN * 60_000);
  const id = randomUUID();
  const txnRef = `${vnpDate(created).slice(2, 8)}${randomBytes(6).toString("hex")}`.toUpperCase();
  await run(
    "INSERT INTO payments (id, txn_ref, payer_id, purpose, amount, provider, status, expires_at, return_path, description, created_at, updated_at) VALUES (?, ?, ?, ?, ?, 'vnpay', 'pending', ?, ?, ?, ?, ?)",
    [id, txnRef, payerId, p.purpose, amount, expires.toISOString(), p.returnPath, p.description.slice(0, 200), created.toISOString(), created.toISOString()],
  );
  for (const i of p.items) {
    await run("INSERT INTO payment_items (payment_id, ref_type, ref_id, payee_id, amount, fee) VALUES (?, ?, ?, ?, ?, ?)", [id, i.refType, i.refId, i.payeeId, i.amount, feeFor(i.amount, feeBps())]);
  }
  await event(id, "created", { amount, items: p.items.length });
  const payUrl = buildPaymentUrl(cfg, {
    txnRef,
    amount,
    orderInfo: `PFC ${p.description}`,
    ipAddr: p.ipAddr,
    returnUrl: `${publicUrl()}/api/payments/vnpay/return`,
    createdAt: created,
    expiresAt: expires,
  });
  return { id, payUrl, expiresAt: expires.toISOString() };
}

async function itemsOf(paymentId: string) {
  return all<{ ref_type: RefType; ref_id: string; payee_id: string; amount: number; fee: number }>("SELECT * FROM payment_items WHERE payment_id = ?", [paymentId]);
}

/** Moves a pending payment to succeeded / failed exactly once, then runs item hooks. */
async function settle(paymentId: string, success: boolean, info: Record<string, string | null>): Promise<boolean> {
  const to = success ? "succeeded" : info.expired ? "expired" : "failed";
  const n = await run(
    "UPDATE payments SET status = ?, provider_txn_no = ?, bank_code = ?, card_type = ?, response_code = ?, paid_at = ?, updated_at = ? WHERE id = ? AND status = 'pending'",
    [to, info.transactionNo ?? null, info.bankCode ?? null, info.cardType ?? null, info.responseCode ?? null, success ? now() : null, now(), paymentId],
  );
  if (n !== 1) return false;
  await event(paymentId, to, { responseCode: info.responseCode ?? null, via: info.via ?? null });
  const p = await one<{ payer_id: string; amount: number; description: string; return_path: string }>("SELECT payer_id, amount, description, return_path FROM payments WHERE id = ?", [paymentId]);
  for (const it of await itemsOf(paymentId)) {
    const h = await hooksFor(it.ref_type);
    if (success) await h.onPaid(it.ref_id, paymentId);
    else await h.onFailed(it.ref_id);
  }
  if (p) {
    await notify(p.payer_id, {
      category: "payments",
      title: success ? `Thanh toán thành công ${p.amount.toLocaleString("vi-VN")}₫` : "Thanh toán chưa thành công",
      body: success ? p.description : `${p.description} — ${info.expired ? "hết thời gian thanh toán" : responseMessage(info.responseCode ?? "")}`,
      href: `/payments/${paymentId}`,
    });
  }
  return true;
}

export type ProviderOutcome = { paymentId: string | null; code: "ok" | "invalid_signature" | "not_found" | "invalid_amount" | "already" ; success: boolean; message: string; returnPath: string | null };

/** Return URL and IPN share this: verify signature, match amount, apply once. */
export async function handleVnpay(query: Record<string, string>, via: "return" | "ipn"): Promise<ProviderOutcome> {
  const cfg = vnpayConfig(process.env);
  if (!cfg) return { paymentId: null, code: "not_found", success: false, message: "Thanh toán trực tuyến chưa bật.", returnPath: null };
  const r = verifyResult(cfg, query);
  if (!r.valid) return { paymentId: null, code: "invalid_signature", success: false, message: "Chữ ký không hợp lệ.", returnPath: null };
  const p = await one<{ id: string; amount: number; status: PaymentStatus; return_path: string }>("SELECT id, amount, status, return_path FROM payments WHERE txn_ref = ?", [r.txnRef]);
  if (!p) return { paymentId: null, code: "not_found", success: false, message: "Không tìm thấy giao dịch.", returnPath: null };
  if (p.amount !== r.amount) {
    await event(p.id, "amount_mismatch", { via, got: r.amount });
    return { paymentId: p.id, code: "invalid_amount", success: false, message: "Số tiền không khớp.", returnPath: p.return_path };
  }
  const applied = await settle(p.id, r.success, { transactionNo: r.transactionNo, bankCode: r.bankCode, cardType: r.cardType, responseCode: r.responseCode, via });
  const fresh = await one<{ status: PaymentStatus }>("SELECT status FROM payments WHERE id = ?", [p.id]);
  return {
    paymentId: p.id,
    code: applied ? "ok" : "already",
    success: fresh?.status === "succeeded" || fresh?.status === "refunded" || fresh?.status === "partially_refunded",
    message: responseMessage(r.responseCode),
    returnPath: p.return_path,
  };
}

/** Pending payments past their deadline (+5 min grace) are expired and their items released. */
export async function expireStale(): Promise<number> {
  const rows = await all<{ id: string }>("SELECT id FROM payments WHERE status = 'pending' AND expires_at < ?", [new Date(Date.now() - 5 * 60_000).toISOString()]);
  let n = 0;
  for (const r of rows) if (await settle(r.id, false, { responseCode: "11", expired: "1", via: "expiry" })) n += 1;
  return n;
}

export type PaymentView = {
  id: string;
  txnRef: string;
  amount: number;
  status: PaymentStatus;
  description: string;
  createdAt: string;
  paidAt: string | null;
  bankCode: string | null;
  responseCode: string | null;
  expiresAt: string;
  items: { refType: RefType; refId: string; title: string; href: string; amount: number }[];
  refunds: RefundView[];
  mine: boolean;
};

export async function getPayment(actor: Actor, id: string): Promise<PaymentView | null> {
  const p = await one<{ id: string; txn_ref: string; payer_id: string; amount: number; status: PaymentStatus; description: string; created_at: string; paid_at: string | null; bank_code: string | null; response_code: string | null; expires_at: string }>(
    "SELECT * FROM payments WHERE id = ?",
    [id],
  );
  if (!p) return null;
  const items = await itemsOf(id);
  const allowed = p.payer_id === actor.id || items.some((i) => i.payee_id === actor.id) || can(actor, "payments.view");
  if (!allowed) return null;
  const described = await Promise.all(items.map(async (i) => ({ refType: i.ref_type, refId: i.ref_id, amount: Number(i.amount), ...(await (await hooksFor(i.ref_type)).describe(i.ref_id)) })));
  return {
    id: p.id,
    txnRef: p.txn_ref,
    amount: Number(p.amount),
    status: p.status,
    description: p.description,
    createdAt: p.created_at,
    paidAt: p.paid_at,
    bankCode: p.bank_code,
    responseCode: p.response_code,
    expiresAt: p.expires_at,
    items: described,
    refunds: await refundsOfPayment(id),
    mine: p.payer_id === actor.id,
  };
}

/** PAY-07 Payment history (mockup 135). */
export async function myPayments(actor: Actor, status?: string): Promise<{ id: string; amount: number; status: PaymentStatus; description: string; createdAt: string }[]> {
  const rows = await all<{ id: string; amount: number; status: PaymentStatus; description: string; created_at: string }>(
    `SELECT id, amount, status, description, created_at FROM payments WHERE payer_id = ? ${status ? "AND status = ?" : ""} ORDER BY created_at DESC LIMIT 100`,
    status ? [actor.id, status] : [actor.id],
  );
  return rows.map((r) => ({ id: r.id, amount: Number(r.amount), status: r.status, description: r.description, createdAt: r.created_at }));
}

/** Latest payment for an item (to resume a pending one or show status). */
export async function paymentForRef(refType: RefType, refId: string): Promise<{ id: string; status: PaymentStatus; expiresAt: string } | null> {
  const r = await one<{ id: string; status: PaymentStatus; expires_at: string }>(
    "SELECT p.id, p.status, p.expires_at FROM payments p JOIN payment_items i ON i.payment_id = p.id WHERE i.ref_type = ? AND i.ref_id = ? ORDER BY p.created_at DESC LIMIT 1",
    [refType, refId],
  );
  return r ? { id: r.id, status: r.status, expiresAt: r.expires_at } : null;
}

// ───────────────────────── Refunds (PAY-08, MKT-20/21; mockups 68–69) ─────────────────────────

export const REFUND_REASONS = {
  event_cancelled: "Sự kiện bị hủy",
  cannot_attend: "Không thể tham dự",
  duplicate: "Thanh toán trùng",
  not_received: "Không nhận được hàng",
  not_as_described: "Hàng không đúng mô tả",
  order_cancelled: "Đơn hàng bị hủy",
  technical: "Lỗi kỹ thuật",
  other: "Khác",
} as const;
export type RefundReason = keyof typeof REFUND_REASONS;
export type RefundStatus = "requested" | "approved" | "rejected" | "processing" | "refunded";
export const REFUND_STATUS_LABEL: Record<RefundStatus, string> = { requested: "Đã gửi yêu cầu", approved: "Đã duyệt", rejected: "Bị từ chối", processing: "Đang xử lý hoàn tiền", refunded: "Đã hoàn tiền" };

export type RefundView = {
  id: string;
  refType: RefType;
  refId: string;
  amount: number;
  reason: RefundReason;
  details: string;
  status: RefundStatus;
  decisionNote: string | null;
  createdAt: string;
  timeline: { status: RefundStatus; note: string | null; at: string }[];
};

async function refundsOfPayment(paymentId: string): Promise<RefundView[]> {
  const rows = await all<{ id: string }>("SELECT id FROM refunds WHERE payment_id = ? ORDER BY created_at", [paymentId]);
  return (await Promise.all(rows.map((r) => refundView(r.id)))).filter((x): x is RefundView => !!x);
}

async function refundView(id: string): Promise<RefundView | null> {
  const r = await one<{ id: string; ref_type: RefType; ref_id: string; amount: number; reason: RefundReason; details: string; status: RefundStatus; decision_note: string | null; created_at: string }>("SELECT * FROM refunds WHERE id = ?", [id]);
  if (!r) return null;
  const tl = await all<{ status: RefundStatus; note: string | null; created_at: string }>("SELECT status, note, created_at FROM refund_events WHERE refund_id = ? ORDER BY created_at", [id]);
  return {
    id: r.id,
    refType: r.ref_type,
    refId: r.ref_id,
    amount: Number(r.amount),
    reason: r.reason,
    details: r.details,
    status: r.status,
    decisionNote: r.decision_note,
    createdAt: r.created_at,
    timeline: tl.map((t) => ({ status: t.status, note: t.note, at: t.created_at })),
  };
}

async function refundEvent(refundId: string, status: RefundStatus, note: string | null, actorId: string | null) {
  await run("INSERT INTO refund_events (id, refund_id, status, note, actor_id, created_at) VALUES (?, ?, ?, ?, ?, ?)", [randomUUID(), refundId, status, note, actorId, now()]);
}

async function paidPaymentFor(refType: RefType, refId: string) {
  return one<{ id: string; payer_id: string; payee_id: string; amount: number }>(
    "SELECT p.id, p.payer_id, i.payee_id, i.amount FROM payments p JOIN payment_items i ON i.payment_id = p.id WHERE i.ref_type = ? AND i.ref_id = ? AND p.status IN ('succeeded','partially_refunded') ORDER BY p.created_at DESC LIMIT 1",
    [refType, refId],
  );
}

/** Payer asks for money back (mockup 68). The payee (seller / organizer) or payment staff decide. */
export async function requestRefund(actor: Actor, input: unknown): Promise<string> {
  const d = z
    .object({
      refType: z.enum(["mkt_order", "evt_registration"]),
      refId: z.string().min(1),
      reason: z.enum(Object.keys(REFUND_REASONS) as [RefundReason, ...RefundReason[]]),
      details: z.string().trim().min(10, "Mô tả thêm ít nhất 10 ký tự.").max(500),
    })
    .parse(input);
  const pay = await paidPaymentFor(d.refType, d.refId);
  if (!pay || pay.payer_id !== actor.id) throw new ActionError("Chỉ yêu cầu hoàn tiền được cho khoản bạn đã thanh toán trực tuyến.");
  const check = await (await hooksFor(d.refType)).refundCheck(actor, d.refId);
  if (!check.ok) throw new ActionError(check.error);
  if (await one("SELECT 1 AS x FROM refunds WHERE ref_type = ? AND ref_id = ? AND status IN ('requested','approved','processing','refunded')", [d.refType, d.refId])) {
    throw new ActionError("Đã có yêu cầu hoàn tiền cho khoản này.");
  }
  const id = randomUUID();
  await run(
    "INSERT INTO refunds (id, payment_id, ref_type, ref_id, requester_id, amount, reason, details, status, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'requested', ?, ?)",
    [id, pay.id, d.refType, d.refId, actor.id, check.amount, d.reason, d.details, now(), now()],
  );
  await refundEvent(id, "requested", null, actor.id);
  const desc = await (await hooksFor(d.refType)).describe(d.refId);
  await notify(check.payeeId, { category: "payments", title: `Yêu cầu hoàn tiền: ${desc.title}`, body: `${REFUND_REASONS[d.reason]} — ${d.details.slice(0, 120)}`, href: `/payments/refunds/${id}` });
  return id;
}

/** System refund when the payee cancels (order cancelled after payment, event cancelled). */
export async function autoRefund(refType: RefType, refId: string, reason: RefundReason, actorId: string): Promise<string | null> {
  const pay = await paidPaymentFor(refType, refId);
  if (!pay) return null;
  if (await one("SELECT 1 AS x FROM refunds WHERE ref_type = ? AND ref_id = ? AND status IN ('approved','processing','refunded')", [refType, refId])) return null;
  await run("UPDATE refunds SET status = 'approved', decided_by = ?, decision_note = 'Tự động: bên bán / ban tổ chức hủy', updated_at = ? WHERE ref_type = ? AND ref_id = ? AND status = 'requested'", [actorId, now(), refType, refId]);
  let id = (await one<{ id: string }>("SELECT id FROM refunds WHERE ref_type = ? AND ref_id = ? AND status = 'approved'", [refType, refId]))?.id ?? null;
  if (!id) {
    id = randomUUID();
    await run(
      "INSERT INTO refunds (id, payment_id, ref_type, ref_id, requester_id, amount, reason, details, status, decided_by, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, 'Hoàn tiền tự động', 'approved', ?, ?, ?)",
      [id, pay.id, refType, refId, pay.payer_id, pay.amount, reason, actorId, now(), now()],
    );
    await refundEvent(id, "requested", "Tự động", actorId);
  }
  await refundEvent(id, "approved", "Tự động: bên bán / ban tổ chức hủy", actorId);
  await processRefund(id, actorId);
  return id;
}

/** Payee or payment staff approve / reject (reject needs a reason). */
export async function decideRefund(actor: Actor, refundId: string, approve: boolean, note?: string): Promise<RefundStatus> {
  const r = await one<{ payment_id: string; ref_type: RefType; ref_id: string; requester_id: string; status: RefundStatus }>("SELECT payment_id, ref_type, ref_id, requester_id, status FROM refunds WHERE id = ?", [refundId]);
  if (!r) throw new ActionError("Không tìm thấy yêu cầu hoàn tiền.");
  const payee = await one<{ payee_id: string }>("SELECT payee_id FROM payment_items WHERE payment_id = ? AND ref_type = ? AND ref_id = ?", [r.payment_id, r.ref_type, r.ref_id]);
  if (payee?.payee_id !== actor.id && !can(actor, "payments.manage")) throw new ActionError("Chỉ bên nhận tiền hoặc Chủ nhiệm duyệt hoàn tiền.");
  if (r.status !== "requested") throw new ActionError("Yêu cầu đã được xử lý.");
  if (!approve && !note?.trim()) throw new ActionError("Cần ghi lý do từ chối.");
  const to: RefundStatus = approve ? "approved" : "rejected";
  const n = await run("UPDATE refunds SET status = ?, decided_by = ?, decision_note = ?, updated_at = ? WHERE id = ? AND status = 'requested'", [to, actor.id, note?.trim() || null, now(), refundId]);
  if (n !== 1) throw new ActionError("Yêu cầu đã được xử lý.");
  await refundEvent(refundId, to, note?.trim() || null, actor.id);
  await audit(actor.id, `payments.refund.${to}`, `refund:${refundId}`, "success");
  if (approve) return processRefund(refundId, actor.id);
  await notify(r.requester_id, { category: "payments", title: "Yêu cầu hoàn tiền bị từ chối", body: `Lý do: ${note!.trim().slice(0, 200)}`, href: `/payments/refunds/${refundId}` });
  return "rejected";
}

/** Calls the VNPAY refund API; if it is unavailable the refund stays "processing" for staff to finish by hand. */
async function processRefund(refundId: string, actorId: string): Promise<RefundStatus> {
  const r = await one<{ payment_id: string; ref_type: RefType; ref_id: string; requester_id: string; amount: number }>("SELECT payment_id, ref_type, ref_id, requester_id, amount FROM refunds WHERE id = ?", [refundId]);
  const p = await one<{ txn_ref: string; amount: number; provider_txn_no: string | null; created_at: string; description: string }>("SELECT txn_ref, amount, provider_txn_no, created_at, description FROM payments WHERE id = ?", [r!.payment_id]);
  await run("UPDATE refunds SET status = 'processing', updated_at = ? WHERE id = ?", [now(), refundId]);
  const cfg = vnpayConfig(process.env);
  let ok = false;
  let note = "Chờ Chủ nhiệm hoàn tiền thủ công";
  if (cfg && p?.provider_txn_no) {
    try {
      const body = buildRefundRequest(cfg, {
        requestId: randomUUID().replace(/-/g, "").slice(0, 32),
        txnRef: p.txn_ref,
        amount: Number(r!.amount),
        full: Number(r!.amount) === Number(p.amount),
        transactionNo: p.provider_txn_no,
        transactionDate: vnpDate(new Date(p.created_at)),
        createBy: "PFC",
        createdAt: new Date(),
        ipAddr: "127.0.0.1",
        orderInfo: `Hoan tien ${p.description}`,
      });
      const res = await fetch(cfg.apiUrl, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body), signal: AbortSignal.timeout(15_000) });
      const j = (await res.json().catch(() => ({}))) as { vnp_ResponseCode?: string; vnp_Message?: string };
      ok = res.ok && j.vnp_ResponseCode === "00";
      note = ok ? "VNPAY đã chấp nhận hoàn tiền" : `VNPAY trả mã ${j.vnp_ResponseCode ?? res.status}: chờ xử lý thủ công`;
    } catch {
      note = "Không gọi được VNPAY: chờ xử lý thủ công";
    }
  }
  await refundEvent(refundId, "processing", note, actorId);
  if (ok) await finishRefund(refundId, null, actorId);
  return ok ? "refunded" : "processing";
}

async function finishRefund(refundId: string, providerRef: string | null, actorId: string): Promise<void> {
  const r = await one<{ payment_id: string; ref_type: RefType; ref_id: string; requester_id: string; amount: number }>("SELECT payment_id, ref_type, ref_id, requester_id, amount FROM refunds WHERE id = ?", [refundId]);
  if (!r) return;
  const n = await run("UPDATE refunds SET status = 'refunded', provider_ref = COALESCE(?, provider_ref), updated_at = ? WHERE id = ? AND status IN ('approved','processing')", [providerRef, now(), refundId]);
  if (n !== 1) return;
  await refundEvent(refundId, "refunded", providerRef ? `Mã tham chiếu: ${providerRef}` : null, actorId);
  const refunded = await one<{ s: number }>("SELECT COALESCE(SUM(amount), 0) AS s FROM refunds WHERE payment_id = ? AND status = 'refunded'", [r.payment_id]);
  const total = await one<{ amount: number }>("SELECT amount FROM payments WHERE id = ?", [r.payment_id]);
  await run("UPDATE payments SET status = ?, updated_at = ? WHERE id = ?", [Number(refunded?.s) >= Number(total?.amount) ? "refunded" : "partially_refunded", now(), r.payment_id]);
  await (await hooksFor(r.ref_type)).onRefunded(r.ref_id);
  await notify(r.requester_id, { category: "payments", title: `Đã hoàn ${Number(r.amount).toLocaleString("vi-VN")}₫`, body: "Tiền về tài khoản / thẻ của bạn trong vài ngày làm việc tùy ngân hàng.", href: `/payments/refunds/${refundId}` });
}

/** Staff finish a refund made outside VNPAY's API (bank transfer back), with a reference. */
export async function markRefunded(actor: Actor, refundId: string, providerRef: string): Promise<void> {
  if (!can(actor, "payments.manage")) throw new ActionError("Chỉ Chủ nhiệm ghi nhận hoàn tiền thủ công.");
  const ref = z.string().trim().min(3, "Nhập mã tham chiếu giao dịch hoàn tiền.").max(100).parse(providerRef);
  const r = await one<{ status: RefundStatus }>("SELECT status FROM refunds WHERE id = ?", [refundId]);
  if (r?.status !== "processing" && r?.status !== "approved") throw new ActionError("Yêu cầu không ở trạng thái chờ hoàn tiền.");
  await finishRefund(refundId, ref, actor.id);
  await audit(actor.id, "payments.refund.manual", `refund:${refundId}`, "success");
}

export async function getRefund(actor: Actor, id: string): Promise<(RefundView & { canDecide: boolean; canFinish: boolean; title: string; href: string }) | null> {
  const r = await one<{ requester_id: string; payment_id: string; ref_type: RefType; ref_id: string }>("SELECT requester_id, payment_id, ref_type, ref_id FROM refunds WHERE id = ?", [id]);
  if (!r) return null;
  const payee = await one<{ payee_id: string }>("SELECT payee_id FROM payment_items WHERE payment_id = ? AND ref_type = ? AND ref_id = ?", [r.payment_id, r.ref_type, r.ref_id]);
  const staff = can(actor, "payments.view");
  if (r.requester_id !== actor.id && payee?.payee_id !== actor.id && !staff) return null;
  const v = await refundView(id);
  if (!v) return null;
  const desc = await (await hooksFor(r.ref_type)).describe(r.ref_id);
  return { ...v, ...desc, canDecide: v.status === "requested" && (payee?.payee_id === actor.id || can(actor, "payments.manage")), canFinish: (v.status === "processing" || v.status === "approved") && can(actor, "payments.manage") };
}

export async function refundForRef(refType: RefType, refId: string): Promise<{ id: string; status: RefundStatus } | null> {
  return one("SELECT id, status FROM refunds WHERE ref_type = ? AND ref_id = ? ORDER BY created_at DESC LIMIT 1", [refType, refId]);
}

/** Refund requests waiting for this payee (or all, for payment staff). */
export async function refundInbox(actor: Actor): Promise<(RefundView & { title: string; href: string })[]> {
  const staff = can(actor, "payments.view");
  const rows = await all<{ id: string; ref_type: RefType; ref_id: string }>(
    `SELECT r.id, r.ref_type, r.ref_id FROM refunds r JOIN payment_items i ON i.payment_id = r.payment_id AND i.ref_type = r.ref_type AND i.ref_id = r.ref_id
     WHERE r.status IN ('requested','approved','processing') ${staff ? "" : "AND i.payee_id = ?"} ORDER BY r.created_at LIMIT 100`,
    staff ? [] : [actor.id],
  );
  const out = [];
  for (const r of rows) {
    const v = await refundView(r.id);
    if (v) out.push({ ...v, ...(await (await hooksFor(r.ref_type)).describe(r.ref_id)) });
  }
  return out;
}

// ───────────────────────── Payouts (SELL-13/14, PAY-A04) ─────────────────────────

/** What PFC holds for a payee: releasable now, still held (order/event not finished), already paid out. */
export async function payeeBalance(payeeId: string): Promise<{ available: number; held: number; paidOut: number; fees: number }> {
  const items = await all<{ ref_type: RefType; ref_id: string; amount: number; fee: number; payout_id: string | null; refunded: number }>(
    `SELECT i.ref_type, i.ref_id, i.amount, i.fee, i.payout_id,
       EXISTS (SELECT 1 FROM refunds r WHERE r.ref_type = i.ref_type AND r.ref_id = i.ref_id AND r.status IN ('approved','processing','refunded')) AS refunded
     FROM payment_items i JOIN payments p ON p.id = i.payment_id WHERE i.payee_id = ? AND p.status IN ('succeeded','partially_refunded')`,
    [payeeId],
  );
  let available = 0;
  let held = 0;
  let fees = 0;
  for (const it of items) {
    if (it.payout_id || Number(it.refunded)) continue;
    const net = Number(it.amount) - Number(it.fee);
    fees += Number(it.fee);
    if (await (await hooksFor(it.ref_type)).releasable(it.ref_id)) available += net;
    else held += net;
  }
  const paid = await one<{ s: number }>("SELECT COALESCE(SUM(amount), 0) AS s FROM payouts WHERE payee_id = ? AND status = 'paid'", [payeeId]);
  return { available, held, paidOut: Number(paid?.s ?? 0), fees };
}

/** Payment staff create a payout for everything releasable for a payee, then mark it paid after the bank transfer. */
export async function createPayout(actor: Actor, payeeId: string): Promise<string> {
  if (!can(actor, "payments.manage")) throw new ActionError("Chỉ Chủ nhiệm tạo khoản chi trả.");
  const items = await all<{ payment_id: string; ref_type: RefType; ref_id: string; amount: number; fee: number }>(
    `SELECT i.payment_id, i.ref_type, i.ref_id, i.amount, i.fee FROM payment_items i JOIN payments p ON p.id = i.payment_id
     WHERE i.payee_id = ? AND i.payout_id IS NULL AND p.status IN ('succeeded','partially_refunded')
       AND NOT EXISTS (SELECT 1 FROM refunds r WHERE r.ref_type = i.ref_type AND r.ref_id = i.ref_id AND r.status IN ('requested','approved','processing','refunded'))`,
    [payeeId],
  );
  const eligible = [];
  for (const it of items) if (await (await hooksFor(it.ref_type)).releasable(it.ref_id)) eligible.push(it);
  if (!eligible.length) throw new ActionError("Chưa có khoản nào đủ điều kiện chi trả.");
  const id = randomUUID();
  const amount = eligible.reduce((s, i) => s + Number(i.amount) - Number(i.fee), 0);
  await run("INSERT INTO payouts (id, payee_id, amount, status, created_by, created_at) VALUES (?, ?, ?, 'pending', ?, ?)", [id, payeeId, amount, actor.id, now()]);
  for (const it of eligible) await run("UPDATE payment_items SET payout_id = ? WHERE payment_id = ? AND ref_type = ? AND ref_id = ? AND payout_id IS NULL", [id, it.payment_id, it.ref_type, it.ref_id]);
  await audit(actor.id, "payments.payout.create", `payout:${id}`, "success");
  return id;
}

export async function markPayoutPaid(actor: Actor, payoutId: string, note: string): Promise<void> {
  if (!can(actor, "payments.manage")) throw new ActionError("Chỉ Chủ nhiệm xác nhận chi trả.");
  const ref = z.string().trim().min(3, "Nhập mã / nội dung chuyển khoản.").max(200).parse(note);
  const p = await one<{ payee_id: string; amount: number }>("SELECT payee_id, amount FROM payouts WHERE id = ? AND status = 'pending'", [payoutId]);
  if (!p) throw new ActionError("Khoản chi trả không ở trạng thái chờ.");
  await run("UPDATE payouts SET status = 'paid', note = ?, paid_at = ?, paid_by = ? WHERE id = ?", [ref, now(), actor.id, payoutId]);
  await audit(actor.id, "payments.payout.paid", `payout:${payoutId}`, "success");
  await notify(p.payee_id, { category: "payments", title: `PFC đã chi trả ${Number(p.amount).toLocaleString("vi-VN")}₫ cho bạn`, body: ref, href: "/payments/payouts" });
}

export async function payoutsOf(payeeId: string): Promise<{ id: string; amount: number; status: "pending" | "paid"; note: string; createdAt: string; paidAt: string | null }[]> {
  return (await all<{ id: string; amount: number; status: "pending" | "paid"; note: string; created_at: string; paid_at: string | null }>("SELECT * FROM payouts WHERE payee_id = ? ORDER BY created_at DESC LIMIT 50", [payeeId])).map((r) => ({
    id: r.id,
    amount: Number(r.amount),
    status: r.status,
    note: r.note,
    createdAt: r.created_at,
    paidAt: r.paid_at,
  }));
}

/** PAY-A01/A04/A05 overview for payment staff. */
export async function adminOverview(actor: Actor): Promise<{
  payments: { id: string; amount: number; status: PaymentStatus; description: string; payer: string; createdAt: string }[];
  payees: { payeeId: string; name: string; available: number; held: number }[];
  pendingPayouts: { id: string; payee: string; amount: number; createdAt: string }[];
  totals: { succeeded: number; refunded: number; fees: number };
}> {
  if (!can(actor, "payments.view")) throw new ActionError("Bạn không có quyền xem thanh toán.");
  const payments = await all<{ id: string; amount: number; status: PaymentStatus; description: string; payer: string; created_at: string }>(
    "SELECT p.id, p.amount, p.status, p.description, m.full_name AS payer, p.created_at FROM payments p JOIN members m ON m.id = p.payer_id ORDER BY p.created_at DESC LIMIT 100",
  );
  const payeeIds = await all<{ payee_id: string; name: string }>("SELECT DISTINCT i.payee_id, m.full_name AS name FROM payment_items i JOIN members m ON m.id = i.payee_id");
  const payees = [];
  for (const p of payeeIds) {
    const b = await payeeBalance(p.payee_id);
    if (b.available || b.held) payees.push({ payeeId: p.payee_id, name: p.name, available: b.available, held: b.held });
  }
  const pendingPayouts = await all<{ id: string; payee: string; amount: number; created_at: string }>(
    "SELECT o.id, m.full_name AS payee, o.amount, o.created_at FROM payouts o JOIN members m ON m.id = o.payee_id WHERE o.status = 'pending' ORDER BY o.created_at",
  );
  const t = await one<{ s: number; r: number; f: number }>(
    `SELECT (SELECT COALESCE(SUM(amount),0) FROM payments WHERE status IN ('succeeded','partially_refunded','refunded')) AS s,
            (SELECT COALESCE(SUM(amount),0) FROM refunds WHERE status = 'refunded') AS r,
            (SELECT COALESCE(SUM(i.fee),0) FROM payment_items i JOIN payments p ON p.id = i.payment_id WHERE p.status IN ('succeeded','partially_refunded')) AS f`,
  );
  return {
    payments: payments.map((p) => ({ id: p.id, amount: Number(p.amount), status: p.status, description: p.description, payer: p.payer, createdAt: p.created_at })),
    payees,
    pendingPayouts: pendingPayouts.map((p) => ({ id: p.id, payee: p.payee, amount: Number(p.amount), createdAt: p.created_at })),
    totals: { succeeded: Number(t?.s ?? 0), refunded: Number(t?.r ?? 0), fees: Number(t?.f ?? 0) },
  };
}

export { REF_LABEL, isRefType };

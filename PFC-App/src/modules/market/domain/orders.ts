/**
 * Marketplace order domain (FR-MKT-006/007/009, BR-007/008/012). Pure, unit tested.
 *
 * placed ──confirm(seller)──▶ confirmed ──ship(seller)──▶ shipping ──deliver(seller)──▶ delivered ──complete(buyer)──▶ completed
 *   │                            │                           └──────────complete(buyer: "đã nhận")──────────────────▲
 *   └─cancel(buyer|seller)───────┴─cancel(seller, reason)──▶ cancelled
 *
 * Payment is settled directly between buyer and seller at launch (no gateway yet — VNPAY is
 * the SRS choice and plugs in behind `payment_method`). A bank-transfer order cannot ship
 * until the seller confirms the money arrived.
 */
export const ORDER_STATUSES = ["placed", "confirmed", "shipping", "delivered", "completed", "cancelled"] as const;
export type OrderStatus = (typeof ORDER_STATUSES)[number];
export type PaymentMethod = "cod" | "bank_transfer" | "in_person" | "vnpay";
export type PaymentStatus = "unpaid" | "paid" | "refunded";
export type OrderAction = "confirm" | "ship" | "deliver" | "complete" | "cancel" | "mark_paid";

export const ORDER_STATUS_LABEL: Record<OrderStatus, string> = {
  placed: "Chờ xác nhận",
  confirmed: "Đã xác nhận",
  shipping: "Đang giao",
  delivered: "Đã giao",
  completed: "Hoàn tất",
  cancelled: "Đã hủy",
};

export const ORDER_TONE: Record<OrderStatus, "warning" | "primary" | "income" | "muted" | "expense"> = {
  placed: "warning",
  confirmed: "primary",
  shipping: "primary",
  delivered: "income",
  completed: "income",
  cancelled: "expense",
};

export const PAYMENT_LABEL: Record<PaymentMethod, string> = {
  cod: "Thanh toán khi nhận hàng (COD)",
  bank_transfer: "Chuyển khoản trực tiếp cho người bán",
  in_person: "Trả tiền khi gặp trực tiếp",
  vnpay: "Thanh toán trực tuyến (VNPAY)",
};

export type OrderState = { status: OrderStatus; paymentMethod: PaymentMethod; paymentStatus: PaymentStatus };
export type Role = "buyer" | "seller";
export type OrderTransition = { ok: true; status: OrderStatus; paymentStatus: PaymentStatus } | { ok: false; error: string };

export function applyOrderAction(o: OrderState, action: OrderAction, role: Role, reason?: string): OrderTransition {
  const deny = (error: string): OrderTransition => ({ ok: false, error });
  const to = (status: OrderStatus, paymentStatus = o.paymentStatus): OrderTransition => ({ ok: true, status, paymentStatus });
  switch (action) {
    case "confirm":
      if (role !== "seller") return deny("Chỉ người bán xác nhận đơn.");
      if (o.paymentMethod === "vnpay" && o.paymentStatus !== "paid") return deny("Đơn VNPAY: chờ người mua thanh toán xong.");
      return o.status === "placed" ? to("confirmed") : deny("Đơn không ở trạng thái chờ xác nhận.");
    case "mark_paid":
      if (role !== "seller") return deny("Chỉ người bán xác nhận đã nhận tiền.");
      if (o.paymentMethod === "vnpay") return deny("Đơn VNPAY được ghi nhận thanh toán tự động.");
      if (o.status === "cancelled") return deny("Đơn đã hủy.");
      return o.paymentStatus === "unpaid" ? to(o.status, "paid") : deny("Đơn đã được ghi nhận thanh toán.");
    case "ship":
      if (role !== "seller") return deny("Chỉ người bán cập nhật giao hàng.");
      if (o.status !== "confirmed") return deny("Hãy xác nhận đơn trước khi giao.");
      if (o.paymentMethod === "bank_transfer" && o.paymentStatus !== "paid") return deny("Đơn chuyển khoản: xác nhận đã nhận tiền trước khi giao.");
      return to("shipping");
    case "deliver":
      if (role !== "seller") return deny("Chỉ người bán cập nhật giao hàng.");
      return o.status === "shipping" ? to("delivered") : deny("Đơn chưa ở trạng thái đang giao.");
    case "complete":
      if (role !== "buyer") return deny("Chỉ người mua xác nhận đã nhận hàng.");
      if (o.status !== "delivered" && o.status !== "shipping") return deny("Chỉ xác nhận khi đơn đang giao hoặc đã giao.");
      // Receiving a COD / in-person order means it was paid at hand-over.
      return to("completed", o.paymentMethod === "bank_transfer" || o.paymentMethod === "vnpay" ? o.paymentStatus : "paid");
    case "cancel":
      if (role === "buyer") return o.status === "placed" ? to("cancelled") : deny("Đơn đã được xác nhận: liên hệ người bán để hủy.");
      if (o.status !== "placed" && o.status !== "confirmed") return deny("Không thể hủy đơn đã giao.");
      if (!reason?.trim()) return deny("Người bán cần ghi lý do hủy.");
      return to("cancelled");
  }
}

/** Which buttons to show for a role; mirrors applyOrderAction (the server re-checks). */
export function availableActions(o: OrderState, role: Role): OrderAction[] {
  const all: OrderAction[] = ["confirm", "mark_paid", "ship", "deliver", "complete", "cancel"];
  return all.filter((a) => applyOrderAction(o, a, role, "x").ok);
}

/** Review only after the buyer completed the order (BR-008). */
export function canReview(status: OrderStatus): boolean {
  return status === "completed";
}

export type CartLine = { listingId: string; sellerId: string; title: string; price: number; qty: number; stock: number | null; available: boolean };

/** Splits a cart into one order per seller and computes server-side totals. */
export function splitCart(lines: readonly CartLine[]) {
  const bySeller = new Map<string, CartLine[]>();
  for (const l of lines) bySeller.set(l.sellerId, [...(bySeller.get(l.sellerId) ?? []), l]);
  return [...bySeller.entries()].map(([sellerId, items]) => ({
    sellerId,
    items,
    total: items.reduce((a, i) => a + i.price * i.qty, 0),
  }));
}

/** Problems that block checkout: unavailable listings or not enough stock. */
export function cartProblems(lines: readonly CartLine[]): string[] {
  const out: string[] = [];
  for (const l of lines) {
    if (!l.available) out.push(`“${l.title}” không còn bán.`);
    else if (l.stock !== null && l.qty > l.stock) out.push(`“${l.title}” chỉ còn ${l.stock}.`);
  }
  return out;
}

/** Human-friendly order code, e.g. PFC251120-7K3Q. */
export function orderCode(now: Date, rand: string): string {
  const d = new Date(now.getTime() + 7 * 3600_000);
  const ymd = `${String(d.getUTCFullYear()).slice(2)}${String(d.getUTCMonth() + 1).padStart(2, "0")}${String(d.getUTCDate()).padStart(2, "0")}`;
  return `PFC${ymd}-${rand.replace(/[^A-Z0-9]/gi, "").slice(0, 4).toUpperCase()}`;
}

export function averageRating(ratings: readonly number[]): number | null {
  if (ratings.length === 0) return null;
  return Math.round((ratings.reduce((a, b) => a + b, 0) / ratings.length) * 10) / 10;
}

export const CATEGORIES = {
  book: "Sách",
  course: "Khóa học",
  stationery: "Văn phòng phẩm",
  electronics: "Đồ điện tử",
  fashion: "Thời trang",
  service: "Dịch vụ",
  template: "Template & tài liệu số",
  ticket: "Vé sự kiện",
  other: "Khác",
} as const;
export type Category = keyof typeof CATEGORIES;

export const KIND_LABEL = { product: "Sản phẩm", digital: "Sản phẩm số", service: "Dịch vụ", course: "Khóa học", ticket: "Vé sự kiện" } as const;
export const DELIVERY_LABEL = { ship: "Giao hàng", pickup: "Nhận tại chỗ", online: "Trực tuyến" } as const;

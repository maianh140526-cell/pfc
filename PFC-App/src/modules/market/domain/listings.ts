/**
 * Listing types and risk-based seller verification (MKT-01…05, SELL-02/03). Pure, unit tested.
 *
 * Two seller levels:
 *  - basic    — self-serve once the account email is verified: low-risk physical / digital items under a price cap,
 *               with a cap on active listings.
 *  - verified — reviewed by staff (mkt.seller.approve) with real name + phone: everything, including services,
 *               courses, event tickets and items above the cap.
 * The caps are PFC settings (Quản trị → Cấu hình), not hard-coded business rules.
 */
export const LISTING_TYPES = {
  product: { label: "Sản phẩm vật lý", hint: "Sách, đồ cũ, đồ dùng học tập…", risk: "low" },
  digital: { label: "Sản phẩm số", hint: "eBook, template, tài liệu…", risk: "low" },
  service: { label: "Dịch vụ", hint: "Kèm học, review CV, thiết kế…", risk: "high" },
  course: { label: "Khóa học", hint: "Liên kết khóa học trong Học tập", risk: "high" },
  ticket: { label: "Vé sự kiện", hint: "Liên kết sự kiện bạn tổ chức", risk: "high" },
} as const;
export type ListingType = keyof typeof LISTING_TYPES;
export const isListingType = (v: unknown): v is ListingType => typeof v === "string" && v in LISTING_TYPES;

export type SellerLevel = "basic" | "verified";
export type MarketLimits = { basicMaxPrice: number; basicMaxListings: number };
export const DEFAULT_MARKET_LIMITS: MarketLimits = { basicMaxPrice: 2_000_000, basicMaxListings: 10 };

/** Why this seller may not publish this listing yet, or null. */
export function listingRiskCheck(level: SellerLevel, l: { kind: ListingType; price: number }, activeListings: number, cfg: MarketLimits, isNew: boolean): string | null {
  if (level === "verified") return null;
  if (LISTING_TYPES[l.kind].risk === "high") return `${LISTING_TYPES[l.kind].label} cần cửa hàng đã xác minh. Gửi yêu cầu xác minh ở Kênh bán hàng.`;
  if (l.price > cfg.basicMaxPrice) return `Cửa hàng chưa xác minh chỉ bán được món tới ${cfg.basicMaxPrice.toLocaleString("vi-VN")}₫. Gửi yêu cầu xác minh để bán giá cao hơn.`;
  if (isNew && activeListings >= cfg.basicMaxListings) return `Cửa hàng chưa xác minh tối đa ${cfg.basicMaxListings} tin đang hoạt động.`;
  return null;
}

/** Tags: lower-case, no commas or "#", 2–24 chars, at most 8, unique. */
export function normalizeTags(raw: readonly string[]): string[] {
  const out: string[] = [];
  for (const t of raw) {
    const s = t.normalize("NFC").toLocaleLowerCase("vi").replace(/[#,]/g, " ").replace(/\s+/g, " ").trim();
    if (s.length >= 2 && s.length <= 24 && !out.includes(s)) out.push(s);
    if (out.length === 8) break;
  }
  return out;
}

/** Condition of a physical item (Tình trạng). */
export const CONDITION_LABEL = { new: "Mới", like_new: "Như mới", used: "Đã qua sử dụng" } as const;
export type Condition = keyof typeof CONDITION_LABEL;
export const isCondition = (v: unknown): v is Condition => typeof v === "string" && v in CONDITION_LABEL;

/** Digital files / access details are revealed to the buyer only once the order is paid and not cancelled. */
export function digitalAccessOpen(o: { paymentStatus: string; status: string }): boolean {
  return o.paymentStatus === "paid" && o.status !== "cancelled";
}

/** Delivery that makes sense for each type. */
export function deliveryFor(kind: ListingType, delivery: "ship" | "pickup" | "online"): "ship" | "pickup" | "online" {
  return kind === "digital" || kind === "course" || kind === "ticket" ? "online" : delivery;
}

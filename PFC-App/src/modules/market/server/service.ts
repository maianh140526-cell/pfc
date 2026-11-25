import "server-only";
import { awardPoints } from "@/modules/rewards/server/service";
import { assertAllowed } from "@/platform/admin/restrictions";
import { notify } from "@/platform/notifications/service";
import { PAYMENT_TTL_MIN, autoRefund, createPayment, onlinePaymentEnabled } from "@/modules/payments/server/service";
import { randomBytes, randomUUID } from "node:crypto";
import { z } from "zod";
import { all, one, run, withTransaction } from "@/platform/db/client";
import { audit } from "@/platform/audit";
import { ActionError } from "@/platform/errors";
import { can, type Actor } from "@/platform/roles";
import { applyWorkflow, canEditContent, canViewContent, isContentStatus, type ContentStatus, type WorkflowAction } from "@/platform/workflow";
import { MAX_AMOUNT_VND } from "@/lib/money";
import { isOwnAttachment, verifyOwnUploadUrls } from "@/platform/uploads/service";
import { getSettings } from "@/platform/settings/service";
import { LISTING_TYPES, deliveryFor, digitalAccessOpen, isCondition, isListingType, listingRiskCheck, normalizeTags, type ListingType, type SellerLevel } from "../domain/listings";
import {
  CATEGORIES,
  applyOrderAction,
  availableActions,
  averageRating,
  canReview,
  cartProblems,
  orderCode,
  splitCart,
  type CartLine,
  type OrderAction,
  type OrderStatus,
  type PaymentMethod,
  type PaymentStatus,
} from "../domain/orders";

/** Marketplace use-cases (FR-MKT). Actor-based; every permission is checked here. */
const now = () => new Date().toISOString();
const statusOf = (s: unknown): ContentStatus => (isContentStatus(s) ? s : "draft");
const likeArg = (q: string) => `%${q.trim().replace(/[\\%_]/g, (m) => `\\${m}`)}%`;

// ───────────────────────── Sellers ─────────────────────────

export type SellerStatus = "pending" | "approved" | "rejected" | "suspended";
export type VerifyStatus = "none" | "pending" | "rejected";
export type Seller = { memberId: string; shopName: string; bio: string; contact: string; status: SellerStatus; rejectReason: string | null; memberName: string; level: SellerLevel; verifyStatus: VerifyStatus; verifyNote: string; legalName: string; phone: string };

export async function getSeller(memberId: string): Promise<Seller | null> {
  const r = await one<{ member_id: string; shop_name: string; bio: string; contact: string; status: SellerStatus; reject_reason: string | null; full_name: string; level: SellerLevel; verify_status: VerifyStatus; verify_note: string; legal_name: string; phone: string }>(
    "SELECT s.*, m.full_name FROM mkt_sellers s JOIN members m ON m.id = s.member_id WHERE s.member_id = ?",
    [memberId],
  );
  return r
    ? { memberId: r.member_id, shopName: r.shop_name, bio: r.bio, contact: r.contact, status: r.status, rejectReason: r.reject_reason, memberName: r.full_name, level: r.level === "verified" ? "verified" : "basic", verifyStatus: r.verify_status, verifyNote: r.verify_note, legalName: r.legal_name, phone: r.phone }
    : null;
}

const sellerSchema = z.object({
  shopName: z.string().trim().min(2, "Tên cửa hàng tối thiểu 2 ký tự.").max(60),
  bio: z.string().trim().max(500).default(""),
  contact: z.string().trim().min(5, "Nhập cách liên hệ (Zalo/điện thoại/email) để người mua trao đổi.").max(120),
});

/** SELL-02 Seller Registration. Staff with seller-approval rights are approved immediately. */
export async function registerSeller(actor: Actor, input: unknown): Promise<SellerStatus> {
  const d = sellerSchema.parse(input);
  const existing = await getSeller(actor.id);
  if (existing?.status === "approved" || existing?.status === "suspended") {
    await run("UPDATE mkt_sellers SET shop_name = ?, bio = ?, contact = ?, updated_at = ? WHERE member_id = ?", [d.shopName, d.bio, d.contact, now(), actor.id]);
    return existing.status;
  }
  // Risk-based: a verified email opens a basic shop at once (low-risk items under the caps); staff open verified shops.
  if (existing?.status === "rejected") throw new ActionError("Hồ sơ người bán đã bị từ chối. Liên hệ hỗ trợ nếu cần xem xét lại.");
  const verified = await one("SELECT 1 AS x FROM members WHERE id = ? AND email_verified_at IS NOT NULL", [actor.id]);
  if (!verified && !can(actor, "mkt.seller.approve")) throw new ActionError("Xác thực email tài khoản trước khi mở cửa hàng (Thêm → Cài đặt tài khoản).");
  const level: SellerLevel = can(actor, "mkt.seller.approve") ? "verified" : "basic";
  await run(
    `INSERT INTO mkt_sellers (member_id, shop_name, bio, contact, status, level, created_at, updated_at) VALUES (?, ?, ?, ?, 'approved', ?, ?, ?)
     ON CONFLICT (member_id) DO UPDATE SET shop_name = excluded.shop_name, bio = excluded.bio, contact = excluded.contact, status = 'approved', reject_reason = NULL, updated_at = excluded.updated_at`,
    [actor.id, d.shopName, d.bio, d.contact, level, now(), now()],
  );
  return "approved";
}

/** SELL-03 Ask for the "verified" level: real name + phone, reviewed by staff. */
export async function requestVerification(actor: Actor, input: unknown): Promise<void> {
  const d = z
    .object({
      legalName: z.string().trim().min(4, "Nhập họ tên thật (trùng giấy tờ).").max(80),
      phone: z
        .string()
        .trim()
        .transform((v) => v.replace(/[\s.-]/g, ""))
        .refine((v) => /^(\+84|0)\d{9,10}$/.test(v), "Số điện thoại không hợp lệ."),
      note: z.string().trim().min(10, "Mô tả bạn định bán gì (tối thiểu 10 ký tự).").max(500),
    })
    .parse(input);
  const s = await getSeller(actor.id);
  if (!s || s.status !== "approved") throw new ActionError("Mở cửa hàng trước khi xin xác minh.");
  if (s.level === "verified") throw new ActionError("Cửa hàng đã được xác minh.");
  if (s.verifyStatus === "pending") throw new ActionError("Yêu cầu xác minh đang chờ duyệt.");
  await run("UPDATE mkt_sellers SET legal_name = ?, phone = ?, verify_note = ?, verify_status = 'pending', updated_at = ? WHERE member_id = ?", [d.legalName, d.phone, d.note, now(), actor.id]);
  await audit(actor.id, "mkt.seller.verify_request", `seller:${actor.id}`, "success");
}

export async function decideVerification(actor: Actor, memberId: string, approve: boolean, reason?: string): Promise<void> {
  if (!can(actor, "mkt.seller.approve")) throw new ActionError("Bạn không có quyền duyệt người bán.");
  const s = await getSeller(memberId);
  if (!s || s.verifyStatus !== "pending") throw new ActionError("Không có yêu cầu xác minh đang chờ.");
  if (!approve && !reason?.trim()) throw new ActionError("Cần ghi lý do từ chối.");
  await run("UPDATE mkt_sellers SET level = ?, verify_status = ?, reject_reason = ?, updated_at = ? WHERE member_id = ?", [approve ? "verified" : s.level, approve ? "none" : "rejected", approve ? null : reason!.trim(), now(), memberId]);
  await audit(actor.id, `mkt.seller.verify_${approve ? "approve" : "reject"}`, `seller:${memberId}`, "success");
  await notify(memberId, {
    category: "market",
    title: approve ? "Cửa hàng của bạn đã được xác minh" : "Yêu cầu xác minh cửa hàng chưa được duyệt",
    body: approve ? "Bạn có thể đăng dịch vụ, khóa học, vé sự kiện và món giá trị cao." : `Lý do: ${reason!.trim().slice(0, 200)}`,
    href: "/market/sell",
  });
}

export async function verificationQueue(actor: Actor): Promise<Seller[]> {
  if (!can(actor, "mkt.seller.approve")) throw new ActionError("Bạn không có quyền duyệt người bán.");
  const rows = await all<{ member_id: string }>("SELECT member_id FROM mkt_sellers WHERE verify_status = 'pending' ORDER BY updated_at");
  return (await Promise.all(rows.map((r) => getSeller(r.member_id)))).filter((x): x is Seller => !!x);
}

export async function listSellersByStatus(actor: Actor, status: SellerStatus): Promise<Seller[]> {
  if (!can(actor, "mkt.seller.approve")) throw new ActionError("Bạn không có quyền duyệt người bán.");
  const rows = await all<{ member_id: string }>("SELECT member_id FROM mkt_sellers WHERE status = ? ORDER BY updated_at", [status]);
  return (await Promise.all(rows.map((r) => getSeller(r.member_id)))).filter((s): s is Seller => !!s);
}

export async function decideSeller(actor: Actor, memberId: string, decision: "approve" | "reject" | "suspend" | "reinstate", reason?: string): Promise<void> {
  if (!can(actor, "mkt.seller.approve")) throw new ActionError("Bạn không có quyền duyệt người bán.");
  const s = await getSeller(memberId);
  if (!s) throw new ActionError("Không tìm thấy người bán.");
  const next: Record<typeof decision, [SellerStatus[], SellerStatus]> = {
    approve: [["pending", "rejected"], "approved"],
    reject: [["pending"], "rejected"],
    suspend: [["approved"], "suspended"],
    reinstate: [["suspended"], "approved"],
  };
  const [from, to] = next[decision];
  if (!from.includes(s.status)) throw new ActionError("Không thể thực hiện ở trạng thái hiện tại.");
  if ((decision === "reject" || decision === "suspend") && !reason?.trim()) throw new ActionError("Cần ghi lý do.");
  await run("UPDATE mkt_sellers SET status = ?, reject_reason = ?, updated_at = ? WHERE member_id = ?", [to, reason?.trim() || null, now(), memberId]);
  if (decision === "suspend") await run("UPDATE mkt_listings SET status = 'archived', updated_at = ? WHERE seller_id = ? AND status = 'published'", [now(), memberId]);
  await audit(actor.id, `mkt.seller.${decision}`, `seller:${memberId}`, "success");
  const msg = { approve: "Cửa hàng của bạn đã được duyệt — bắt đầu đăng tin", reject: "Hồ sơ người bán bị từ chối", suspend: "Cửa hàng của bạn bị tạm ngưng", reinstate: "Cửa hàng của bạn hoạt động trở lại" }[decision];
  await notify(memberId, { category: "market", title: msg, body: reason?.trim() ? `Lý do: ${reason.trim().slice(0, 200)}` : "", href: "/market/sell" });
}

// ───────────────────────── Listings ─────────────────────────

export type Listing = {
  id: string;
  sellerId: string;
  shopName: string;
  kind: ListingType;
  category: keyof typeof CATEGORIES;
  title: string;
  description: string;
  price: number;
  stock: number | null;
  delivery: "ship" | "pickup" | "online";
  status: ContentStatus;
  rejectReason: string | null;
  rating: number | null;
  reviewCount: number;
  sold: number;
  /** Server-processed photo URLs; the first is the cover. */
  images: string[];
  currency: "VND";
  tags: string[];
  courseId: string | null;
  courseTitle: string | null;
  eventId: string | null;
  eventTitle: string | null;
  sellerLevel: SellerLevel;
  /** Per-type details (empty when not applicable). */
  itemCondition: string;
  deliveryArea: string;
  serviceScope: string;
  availability: string;
  quotation: string;
};

export const MAX_LISTING_IMAGES = 6;

function parseImages(raw: unknown): string[] {
  try {
    const v = JSON.parse(typeof raw === "string" ? raw : "[]");
    return Array.isArray(v) ? v.filter((u): u is string => typeof u === "string" && (u.startsWith("/api/files/") || u.startsWith("https://"))) : [];
  } catch {
    return [];
  }
}

const LISTING_SQL = `SELECT l.*, COALESCE(s.shop_name, m.full_name) AS shop_name, COALESCE(s.level, 'basic') AS seller_level,
  (SELECT title FROM edu_courses c WHERE c.id = l.course_id) AS course_title,
  (SELECT title FROM evt_events e WHERE e.id = l.event_id) AS event_title,
  (SELECT AVG(rating) FROM mkt_reviews r WHERE r.listing_id = l.id) AS rating,
  (SELECT COUNT(*) FROM mkt_reviews r WHERE r.listing_id = l.id) AS review_count,
  (SELECT COALESCE(SUM(oi.qty),0) FROM mkt_order_items oi JOIN mkt_orders o ON o.id = oi.order_id WHERE oi.listing_id = l.id AND o.status = 'completed') AS sold
  FROM mkt_listings l JOIN members m ON m.id = l.seller_id LEFT JOIN mkt_sellers s ON s.member_id = l.seller_id`;

type ListingRow = {
  id: string;
  seller_id: string;
  shop_name: string;
  kind: Listing["kind"];
  category: Listing["category"];
  title: string;
  description: string;
  price: number;
  stock: number | null;
  delivery: Listing["delivery"];
  status: string;
  reject_reason: string | null;
  rating: number | null;
  review_count: number;
  sold: number;
  images: string;
  tags: string;
  course_id: string | null;
  course_title: string | null;
  event_id: string | null;
  event_title: string | null;
  seller_level: string;
  item_condition: string;
  delivery_area: string;
  service_scope: string;
  availability: string;
  quotation: string;
  access_info: string;
  file_url: string;
  file_name: string;
};
const toListing = (r: ListingRow): Listing => ({
  id: r.id,
  sellerId: r.seller_id,
  shopName: r.shop_name,
  kind: r.kind,
  category: r.category,
  title: r.title,
  description: r.description,
  price: Number(r.price),
  stock: r.stock === null ? null : Number(r.stock),
  delivery: r.delivery,
  status: statusOf(r.status),
  rejectReason: r.reject_reason,
  rating: r.rating === null ? null : Math.round(Number(r.rating) * 10) / 10,
  reviewCount: Number(r.review_count),
  sold: Number(r.sold),
  images: parseImages(r.images),
  currency: "VND",
  tags: r.tags ? r.tags.split(",").filter(Boolean) : [],
  courseId: r.course_id,
  courseTitle: r.course_title,
  eventId: r.event_id,
  eventTitle: r.event_title,
  sellerLevel: r.seller_level === "verified" ? "verified" : "basic",
  itemCondition: r.item_condition,
  deliveryArea: r.delivery_area,
  serviceScope: r.service_scope,
  availability: r.availability,
  quotation: r.quotation,
});

export async function listPublished(f: { q?: string; category?: string; kind?: string; sellerId?: string; sort?: string; tag?: string } = {}): Promise<Listing[]> {
  const where = ["l.status = 'published'"];
  const args: string[] = [];
  if (f.category && f.category in CATEGORIES) (where.push("l.category = ?"), args.push(f.category));
  if (isListingType(f.kind)) (where.push("l.kind = ?"), args.push(f.kind));
  if (f.tag?.trim()) (where.push("(',' || l.tags || ',') LIKE ? ESCAPE '\\'"), args.push(`%,${f.tag.trim().toLocaleLowerCase("vi").replace(/[\\%_]/g, (m) => `\\${m}`)},%`));
  if (f.sellerId) (where.push("l.seller_id = ?"), args.push(f.sellerId));
  if (f.q?.trim()) (where.push("(l.title LIKE ? ESCAPE '\\' OR l.description LIKE ? ESCAPE '\\' OR l.tags LIKE ? ESCAPE '\\')"), args.push(likeArg(f.q), likeArg(f.q), likeArg(f.q)));
  const order = f.sort === "price_asc" ? "l.price ASC" : f.sort === "price_desc" ? "l.price DESC" : "l.updated_at DESC";
  return (await all<ListingRow>(`${LISTING_SQL} WHERE ${where.join(" AND ")} ORDER BY ${order} LIMIT 200`, args)).map(toListing);
}

export async function getListing(actor: Actor | null, id: string) {
  const r = await one<ListingRow>(`${LISTING_SQL} WHERE l.id = ?`, [id]);
  if (!r) return null;
  const who = { isAuthor: !!actor && actor.id === r.seller_id, canApprove: can(actor, "mkt.listing.approve") };
  if (!canViewContent(statusOf(r.status), who)) return null;
  const reviews = await all<{ id: string; rating: number; comment: string; created_at: string; full_name: string }>(
    "SELECT r.id, r.rating, r.comment, r.created_at, m.full_name FROM mkt_reviews r JOIN members m ON m.id = r.buyer_id WHERE r.listing_id = ? ORDER BY r.created_at DESC LIMIT 50",
    [id],
  );
  const fav = actor ? await one("SELECT 1 AS x FROM mkt_favorites WHERE member_id = ? AND listing_id = ?", [actor.id, id]) : null;
  return {
    ...toListing(r),
    reviews: reviews.map((x) => ({ id: x.id, rating: Number(x.rating), comment: x.comment, createdAt: x.created_at, buyerName: x.full_name })),
    // Private delivery details: only the seller sees them here (buyers get them from a paid order).
    access: who.isAuthor ? { info: r.access_info, fileUrl: r.file_url, fileName: r.file_name } : null,
    isOwner: who.isAuthor,
    canApprove: who.canApprove,
    canEdit: canEditContent(statusOf(r.status), who) || (who.isAuthor && statusOf(r.status) === "published"),
    favorite: !!fav,
  };
}

const listingSchema = z
  .object({
    kind: z.enum(Object.keys(LISTING_TYPES) as [ListingType, ...ListingType[]]),
    category: z.string().refine((c) => c in CATEGORIES, "Chọn danh mục."),
    title: z.string().trim().min(3, "Tiêu đề tối thiểu 3 ký tự.").max(120),
    description: z.string().trim().min(10, "Mô tả tối thiểu 10 ký tự.").max(5000),
    price: z.coerce.number().int("Giá phải là số nguyên.").min(0, "Giá không âm.").max(MAX_AMOUNT_VND),
    stock: z.union([z.coerce.number().int().min(0).max(100000), z.null()]).default(null),
    delivery: z.enum(["ship", "pickup", "online"]),
    images: z.array(z.string()).max(MAX_LISTING_IMAGES, `Tối đa ${MAX_LISTING_IMAGES} ảnh.`).default([]),
    currency: z.literal("VND").default("VND"),
    tags: z.array(z.string().max(40)).max(20).default([]),
    courseId: z.string().nullable().optional(),
    eventId: z.string().nullable().optional(),
    itemCondition: z.string().default(""),
    deliveryArea: z.string().trim().max(200, "Khu vực tối đa 200 ký tự.").default(""),
    serviceScope: z.string().trim().max(1500, "Phạm vi dịch vụ tối đa 1.500 ký tự.").default(""),
    availability: z.string().trim().max(300, "Thời gian sẵn sàng tối đa 300 ký tự.").default(""),
    quotation: z.string().trim().max(500, "Cách báo giá tối đa 500 ký tự.").default(""),
    accessInfo: z.string().trim().max(2000, "Hướng dẫn truy cập tối đa 2.000 ký tự.").default(""),
    fileUrl: z.string().trim().max(500).default(""),
    fileName: z.string().trim().max(120).default(""),
  })
  .superRefine((v, ctx) => {
    if (v.kind === "product" && !isCondition(v.itemCondition)) ctx.addIssue({ code: "custom", message: "Chọn tình trạng sản phẩm.", path: ["itemCondition"] });
    if (v.kind === "product" && v.delivery !== "online" && !v.deliveryArea) ctx.addIssue({ code: "custom", message: "Nhập khu vực giao / nhận hàng.", path: ["deliveryArea"] });
    if (v.kind === "service" && v.serviceScope.length < 10) ctx.addIssue({ code: "custom", message: "Mô tả phạm vi dịch vụ (tối thiểu 10 ký tự).", path: ["serviceScope"] });
    if (v.kind === "service" && !v.availability && !v.quotation) ctx.addIssue({ code: "custom", message: "Nhập thời gian sẵn sàng hoặc cách báo giá.", path: ["availability"] });
    if (v.kind === "digital" && !v.fileUrl && !v.accessInfo) ctx.addIssue({ code: "custom", message: "Đính kèm tệp hoặc nhập link / hướng dẫn truy cập cho người mua.", path: ["accessInfo"] });
    if (v.kind === "course" && !v.courseId) ctx.addIssue({ code: "custom", message: "Chọn khóa học trong Học tập để liên kết." });
    if (v.kind === "ticket" && !v.eventId) ctx.addIssue({ code: "custom", message: "Chọn sự kiện bạn tổ chức để bán vé." });
  });

async function requireApprovedSeller(actor: Actor) {
  const s = await getSeller(actor.id);
  if (!s || s.status !== "approved") throw new ActionError(s?.status === "pending" ? "Hồ sơ người bán đang chờ duyệt." : "Bạn cần đăng ký và được duyệt làm người bán trước.");
}

type ListingInput = z.infer<typeof listingSchema>;

/**
 * Applies the listing-type rules: risk-based seller level, links to the seller's own course / event,
 * ticket price taken from the event, normalized tags and delivery.
 */
async function prepareListing(actor: Actor, d: ListingInput, isNew: boolean) {
  const seller = await getSeller(actor.id);
  const active = Number((await one<{ n: number }>("SELECT COUNT(*) AS n FROM mkt_listings WHERE seller_id = ? AND status IN ('draft','submitted','published')", [actor.id]))?.n ?? 0);
  let price = d.price;
  let courseId: string | null = null;
  let eventId: string | null = null;
  let stock = d.stock;
  if (d.kind === "course") {
    const c = await one<{ author_id: string; status: string }>("SELECT author_id, status FROM edu_courses WHERE id = ?", [d.courseId!]);
    if (!c || c.author_id !== actor.id) throw new ActionError("Chỉ liên kết được khóa học do bạn tạo trong Học tập.");
    if (c.status !== "published") throw new ActionError("Khóa học cần được duyệt và xuất bản trước khi bán.");
    courseId = d.courseId!;
  }
  if (d.kind === "ticket") {
    const e = await one<{ organizer_id: string; status: string; min_price: number | null }>(
      "SELECT e.organizer_id, e.status, (SELECT MIN(price) FROM evt_ticket_types t WHERE t.event_id = e.id) AS min_price FROM evt_events e WHERE e.id = ?",
      [d.eventId!],
    );
    if (!e || e.organizer_id !== actor.id) throw new ActionError("Chỉ bán vé được cho sự kiện do bạn tổ chức.");
    if (e.status !== "published") throw new ActionError("Sự kiện cần được duyệt và mở đăng ký trước.");
    eventId = d.eventId!;
    price = Number(e.min_price ?? 0); // tickets are bought through the event page; price shown "từ …"
    stock = null;
  }
  const err = listingRiskCheck(seller?.level ?? "basic", { kind: d.kind, price }, active, (await getSettings()).market, isNew);
  if (err) throw new ActionError(err, "seller_verification");
  let fileUrl = "";
  if (d.kind === "digital" && d.fileUrl) {
    if (!(await isOwnAttachment(actor, d.fileUrl))) throw new ActionError("Tệp đính kèm không hợp lệ hoặc không phải của bạn.");
    fileUrl = d.fileUrl;
  }
  // Keep only the details that belong to the chosen type.
  const physical = d.kind === "product";
  const details = {
    itemCondition: physical ? d.itemCondition : "",
    deliveryArea: physical ? d.deliveryArea : "",
    serviceScope: d.kind === "service" ? d.serviceScope : "",
    availability: d.kind === "service" ? d.availability : "",
    quotation: d.kind === "service" ? d.quotation : "",
    accessInfo: d.kind === "digital" || d.kind === "course" ? d.accessInfo : "",
    fileUrl,
    fileName: fileUrl ? d.fileName : "",
  };
  return { ...d, ...details, price, stock, courseId, eventId, tags: normalizeTags(d.tags), delivery: deliveryFor(d.kind, d.delivery) };
}

/** Courses / events a seller may link (their own, published). */
export async function linkableItems(actor: Actor): Promise<{ courses: { id: string; title: string }[]; events: { id: string; title: string; startsAt: string }[] }> {
  const courses = await all<{ id: string; title: string }>("SELECT id, title FROM edu_courses WHERE author_id = ? AND status = 'published' ORDER BY updated_at DESC", [actor.id]);
  const events = await all<{ id: string; title: string; starts_at: string }>("SELECT id, title, starts_at FROM evt_events WHERE organizer_id = ? AND status = 'published' ORDER BY starts_at", [actor.id]);
  return { courses, events: events.map((e) => ({ id: e.id, title: e.title, startsAt: e.starts_at })) };
}

/** Popular tags among published listings (filter chips). */
export async function popularTags(limit = 12): Promise<string[]> {
  const rows = await all<{ tags: string }>("SELECT tags FROM mkt_listings WHERE status = 'published' AND tags != ''");
  const count = new Map<string, number>();
  for (const r of rows) for (const t of r.tags.split(",")) if (t) count.set(t, (count.get(t) ?? 0) + 1);
  return [...count.entries()].sort((a, b) => b[1] - a[1]).slice(0, limit).map(([t]) => t);
}

export async function createListing(actor: Actor, input: unknown): Promise<string> {
  await assertAllowed(actor.id, "market_sell");
  await requireApprovedSeller(actor);
  const d = await prepareListing(actor, listingSchema.parse(input), true);
  const images = await verifyOwnUploadUrls(actor, "listing", d.images, MAX_LISTING_IMAGES);
  const id = randomUUID();
  await run(
    "INSERT INTO mkt_listings (id, seller_id, kind, category, title, description, price, currency, stock, delivery, images, tags, course_id, event_id, item_condition, delivery_area, service_scope, availability, quotation, access_info, file_url, file_name, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, 'VND', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
    [id, actor.id, d.kind, d.category, d.title, d.description, d.price, d.stock, d.delivery, JSON.stringify(images), d.tags.join(","), d.courseId, d.eventId, d.itemCondition, d.deliveryArea, d.serviceScope, d.availability, d.quotation, d.accessInfo, d.fileUrl, d.fileName, now(), now()],
  );
  return id;
}

/** Owners edit drafts/rejected freely; editing a published listing sends it back for review (BR-010). */
export async function updateListing(actor: Actor, id: string, input: unknown): Promise<ContentStatus> {
  const r = await one<{ seller_id: string; status: string }>("SELECT seller_id, status FROM mkt_listings WHERE id = ?", [id]);
  if (!r) throw new ActionError("Không tìm thấy tin đăng.");
  const isOwner = r.seller_id === actor.id;
  const status = statusOf(r.status);
  if (!isOwner) throw new ActionError("Bạn chỉ sửa được tin đăng của mình.");
  if (status === "submitted") throw new ActionError("Tin đang chờ duyệt, chưa sửa được.");
  await requireApprovedSeller(actor);
  const d = await prepareListing(actor, listingSchema.parse(input), false);
  const images = await verifyOwnUploadUrls(actor, "listing", d.images, MAX_LISTING_IMAGES);
  const next: ContentStatus = status === "rejected" ? "draft" : status === "published" ? (can(actor, "mkt.listing.approve") ? "published" : "submitted") : status;
  await run("UPDATE mkt_listings SET kind = ?, category = ?, title = ?, description = ?, price = ?, stock = ?, delivery = ?, images = ?, tags = ?, course_id = ?, event_id = ?, item_condition = ?, delivery_area = ?, service_scope = ?, availability = ?, quotation = ?, access_info = ?, file_url = ?, file_name = ?, status = ?, updated_at = ? WHERE id = ?", [
    d.kind,
    d.category,
    d.title,
    d.description,
    d.price,
    d.stock,
    d.delivery,
    JSON.stringify(images),
    d.tags.join(","),
    d.courseId,
    d.eventId,
    d.itemCondition,
    d.deliveryArea,
    d.serviceScope,
    d.availability,
    d.quotation,
    d.accessInfo,
    d.fileUrl,
    d.fileName,
    next,
    now(),
    id,
  ]);
  return next;
}

export async function listingTransition(actor: Actor, id: string, action: WorkflowAction, reason?: string): Promise<ContentStatus> {
  const r = await one<{ seller_id: string; status: string }>("SELECT seller_id, status FROM mkt_listings WHERE id = ?", [id]);
  if (!r) throw new ActionError("Không tìm thấy tin đăng.");
  if (action === "submit") {
    await requireApprovedSeller(actor);
    const l = await one<{ kind: ListingType; price: number }>("SELECT kind, price FROM mkt_listings WHERE id = ?", [id]);
    const seller = await getSeller(actor.id);
    const err = l && listingRiskCheck(seller?.level ?? "basic", { kind: l.kind, price: Number(l.price) }, 0, (await getSettings()).market, false);
    if (err) throw new ActionError(err, "seller_verification");
  }
  const res = applyWorkflow(action, statusOf(r.status), { isAuthor: r.seller_id === actor.id, canApprove: can(actor, "mkt.listing.approve") }, reason);
  if (!res.ok) throw new ActionError(res.error);
  await run("UPDATE mkt_listings SET status = ?, reject_reason = ?, updated_at = ? WHERE id = ?", [res.to, res.to === "rejected" ? reason!.trim().slice(0, 500) : null, now(), id]);
  await audit(actor.id, `mkt.listing.${action}`, `listing:${id}`, "success");
  if (r.seller_id !== actor.id && (res.to === "published" || res.to === "rejected" || res.to === "archived")) {
    const verb = res.to === "published" ? "đã được duyệt và đang bán" : res.to === "rejected" ? "bị từ chối" : "đã bị gỡ";
    await notify(r.seller_id, { category: "market", title: `Tin đăng của bạn ${verb}`, body: res.to === "rejected" ? `Lý do: ${reason!.trim().slice(0, 200)}` : "", href: `/market/sell/listings/${id}` });
  }
  return res.to;
}

/** Owners may delete listings that were never sold; otherwise archive (orders keep their history). */
export async function deleteListing(actor: Actor, id: string): Promise<void> {
  const r = await one<{ seller_id: string }>("SELECT seller_id FROM mkt_listings WHERE id = ?", [id]);
  if (!r) throw new ActionError("Không tìm thấy tin đăng.");
  if (r.seller_id !== actor.id) throw new ActionError("Bạn chỉ xóa được tin đăng của mình.");
  const used = await one("SELECT 1 AS x FROM mkt_order_items WHERE listing_id = ? LIMIT 1", [id]);
  if (used) throw new ActionError("Tin đã có đơn hàng: hãy gỡ xuống thay vì xóa.");
  await run("DELETE FROM mkt_listings WHERE id = ?", [id]);
}

export async function myListings(actor: Actor): Promise<Listing[]> {
  return (await all<ListingRow>(`${LISTING_SQL} WHERE l.seller_id = ? ORDER BY l.updated_at DESC`, [actor.id])).map(toListing);
}

export async function listingQueue(actor: Actor): Promise<Listing[]> {
  if (!can(actor, "mkt.listing.approve")) throw new ActionError("Bạn không có quyền duyệt tin đăng.");
  return (await all<ListingRow>(`${LISTING_SQL} WHERE l.status = 'submitted' ORDER BY l.updated_at`)).map(toListing);
}

export async function toggleFavorite(actor: Actor, listingId: string): Promise<boolean> {
  const removed = await run("DELETE FROM mkt_favorites WHERE member_id = ? AND listing_id = ?", [actor.id, listingId]);
  if (removed > 0) return false;
  const l = await one("SELECT 1 AS x FROM mkt_listings WHERE id = ? AND status = 'published'", [listingId]);
  if (!l) throw new ActionError("Tin đăng không còn bán.");
  await run("INSERT INTO mkt_favorites (member_id, listing_id) VALUES (?, ?)", [actor.id, listingId]);
  return true;
}

export async function listFavorites(actor: Actor): Promise<Listing[]> {
  return (await all<ListingRow>(`${LISTING_SQL} JOIN mkt_favorites f ON f.listing_id = l.id WHERE f.member_id = ? ORDER BY l.updated_at DESC`, [actor.id])).map(toListing);
}

// ───────────────────────── Cart & checkout ─────────────────────────

const qtySchema = z.coerce.number().int().min(1, "Số lượng tối thiểu 1.").max(99, "Tối đa 99.");

export async function addToCart(actor: Actor, listingId: string, qty: unknown = 1): Promise<void> {
  const n = qtySchema.parse(qty);
  const l = await one<{ seller_id: string; status: string; stock: number | null; kind: string }>("SELECT seller_id, status, stock, kind FROM mkt_listings WHERE id = ?", [listingId]);
  if (!l || l.status !== "published") throw new ActionError("Sản phẩm không còn bán.");
  if (l.kind === "ticket") throw new ActionError("Vé sự kiện được mua tại trang sự kiện.");
  if (l.seller_id === actor.id) throw new ActionError("Bạn không thể mua sản phẩm của chính mình.");
  const cur = await one<{ qty: number }>("SELECT qty FROM mkt_cart_items WHERE member_id = ? AND listing_id = ?", [actor.id, listingId]);
  const total = Number(cur?.qty ?? 0) + n;
  if (l.stock !== null && total > Number(l.stock)) throw new ActionError(`Chỉ còn ${l.stock} sản phẩm.`);
  await run(
    "INSERT INTO mkt_cart_items (member_id, listing_id, qty, added_at) VALUES (?, ?, ?, ?) ON CONFLICT (member_id, listing_id) DO UPDATE SET qty = excluded.qty",
    [actor.id, listingId, Math.min(total, 99), now()],
  );
}

export async function setCartQty(actor: Actor, listingId: string, qty: unknown): Promise<void> {
  const n = z.coerce.number().int().min(0).max(99).parse(qty);
  if (n === 0) {
    await run("DELETE FROM mkt_cart_items WHERE member_id = ? AND listing_id = ?", [actor.id, listingId]);
    return;
  }
  await run("UPDATE mkt_cart_items SET qty = ? WHERE member_id = ? AND listing_id = ?", [n, actor.id, listingId]);
}

export async function getCart(actor: Actor) {
  const rows = await all<{ listing_id: string; seller_id: string; title: string; price: number; qty: number; stock: number | null; status: string; delivery: string; shop_name: string }>(
    `SELECT c.listing_id, l.seller_id, l.title, l.price, c.qty, l.stock, l.status, l.delivery, COALESCE(s.shop_name, m.full_name) AS shop_name
     FROM mkt_cart_items c JOIN mkt_listings l ON l.id = c.listing_id JOIN members m ON m.id = l.seller_id LEFT JOIN mkt_sellers s ON s.member_id = l.seller_id
     WHERE c.member_id = ? ORDER BY c.added_at`,
    [actor.id],
  );
  const lines: Array<CartLine & { delivery: string; shopName: string }> = rows.map((r) => ({
    listingId: r.listing_id,
    sellerId: r.seller_id,
    title: r.title,
    price: Number(r.price),
    qty: Number(r.qty),
    stock: r.stock === null ? null : Number(r.stock),
    available: r.status === "published",
    delivery: r.delivery,
    shopName: r.shop_name,
  }));
  const groups = splitCart(lines).map((g) => ({ ...g, shopName: (g.items[0] as (typeof lines)[number]).shopName }));
  return { lines, groups, problems: cartProblems(lines), total: groups.reduce((a, g) => a + g.total, 0), needsAddress: lines.some((l) => l.delivery === "ship") };
}

export async function cartCount(actor: Actor): Promise<number> {
  return Number((await one<{ n: number }>("SELECT COALESCE(SUM(qty),0) AS n FROM mkt_cart_items WHERE member_id = ?", [actor.id]))?.n ?? 0);
}

const checkoutSchema = z.object({
  paymentMethod: z.enum(["cod", "bank_transfer", "in_person", "vnpay"]),
  recipientName: z.string().trim().min(2, "Nhập tên người nhận.").max(80),
  recipientPhone: z.string().trim().regex(/^(\+84|0)\d{9,10}$/, "Số điện thoại không hợp lệ."),
  address: z.string().trim().max(300).default(""),
  note: z.string().trim().max(500).default(""),
  checkoutKey: z.string().min(8).max(80),
});

/**
 * MKT-12 Checkout: one order per seller, prices and totals computed here from the DB (never from
 * the client), stock decremented atomically, and the same checkoutKey never creates duplicates.
 */
export async function checkout(actor: Actor, input: unknown): Promise<string[]> {
  const d = checkoutSchema.parse(input);
  const existing = await all<{ id: string }>("SELECT id FROM mkt_orders WHERE buyer_id = ? AND checkout_key = ?", [actor.id, d.checkoutKey]);
  if (existing.length) return existing.map((e) => e.id); // retry / double tap
  const cart = await getCart(actor);
  if (cart.lines.length === 0) throw new ActionError("Giỏ hàng trống.");
  if (cart.problems.length) throw new ActionError(cart.problems[0]);
  if (cart.needsAddress && d.address.length < 10) throw new ActionError("Nhập địa chỉ giao hàng đầy đủ.");
  if (d.paymentMethod === "cod" && !cart.needsAddress) throw new ActionError("COD chỉ dùng cho đơn giao hàng.");
  if (d.paymentMethod === "vnpay" && !onlinePaymentEnabled()) throw new ActionError("Thanh toán trực tuyến chưa được bật. Chọn cách thanh toán khác.");
  const dueAt = d.paymentMethod === "vnpay" ? new Date(Date.now() + PAYMENT_TTL_MIN * 60_000).toISOString() : null;

  const placed = await withTransaction(async (t) => {
    const ids: string[] = [];
    for (const g of cart.groups) {
      const id = randomUUID();
      const code = orderCode(new Date(), randomBytes(4).toString("hex"));
      await t.execute(
        `INSERT INTO mkt_orders (id, code, buyer_id, seller_id, status, payment_method, total, recipient_name, recipient_phone, address, note, checkout_key, payment_due_at, created_at, updated_at)
         VALUES (?, ?, ?, ?, 'placed', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [id, code, actor.id, g.sellerId, d.paymentMethod, g.total, d.recipientName, d.recipientPhone, d.address, d.note, d.checkoutKey, dueAt, now(), now()],
      );
      for (const item of g.items) {
        const dec = await t.execute(
          "UPDATE mkt_listings SET stock = CASE WHEN stock IS NULL THEN NULL ELSE stock - ? END WHERE id = ? AND status = 'published' AND (stock IS NULL OR stock >= ?)",
          [item.qty, item.listingId, item.qty],
        );
        if (dec.rowsAffected === 0) throw new ActionError(`“${item.title}” vừa hết hàng hoặc ngừng bán.`);
        await t.execute("INSERT INTO mkt_order_items (order_id, listing_id, title, unit_price, qty) VALUES (?, ?, ?, ?, ?)", [id, item.listingId, item.title, item.price, item.qty]);
      }
      await t.execute("INSERT INTO mkt_order_events (id, order_id, actor_id, from_status, to_status, note, created_at) VALUES (?, ?, ?, NULL, 'placed', NULL, ?)", [randomUUID(), id, actor.id, now()]);
      ids.push(id);
    }
    await t.execute("DELETE FROM mkt_cart_items WHERE member_id = ?", [actor.id]);
    return ids;
  });
  // After commit: each seller hears about their new order (VNPAY orders only once they are paid).
  if (d.paymentMethod === "vnpay") return placed;
  for (const id of placed) {
    const o = await one<{ seller_id: string; code: string }>("SELECT seller_id, code FROM mkt_orders WHERE id = ?", [id]);
    if (o) await notify(o.seller_id, { category: "market", title: `Đơn hàng mới #${o.code}`, body: "Vào Đơn bán để xác nhận đơn.", href: `/market/orders/${id}` });
  }
  return placed;
}

// ───────────────────────── Orders ─────────────────────────

export type OrderSummary = { id: string; code: string; status: OrderStatus; total: number; createdAt: string; counterpart: string; itemCount: number; firstTitle: string; paymentMethod: PaymentMethod; paymentStatus: PaymentStatus };

async function listOrders(where: string, args: string[], counterpartJoin: "buyer" | "seller"): Promise<OrderSummary[]> {
  const rows = await all<{ id: string; code: string; status: OrderStatus; total: number; created_at: string; counterpart: string; item_count: number; first_title: string; payment_method: PaymentMethod; payment_status: PaymentStatus }>(
    `SELECT o.id, o.code, o.status, o.total, o.created_at, o.payment_method, o.payment_status,
       ${counterpartJoin === "seller" ? "COALESCE(s.shop_name, m.full_name)" : "m.full_name"} AS counterpart,
       (SELECT SUM(qty) FROM mkt_order_items i WHERE i.order_id = o.id) AS item_count,
       (SELECT title FROM mkt_order_items i WHERE i.order_id = o.id LIMIT 1) AS first_title
     FROM mkt_orders o JOIN members m ON m.id = o.${counterpartJoin}_id LEFT JOIN mkt_sellers s ON s.member_id = o.seller_id
     WHERE ${where} ORDER BY o.created_at DESC LIMIT 200`,
    args,
  );
  return rows.map((r) => ({
    id: r.id,
    code: r.code,
    status: r.status,
    total: Number(r.total),
    createdAt: r.created_at,
    counterpart: r.counterpart,
    itemCount: Number(r.item_count),
    firstTitle: r.first_title,
    paymentMethod: r.payment_method,
    paymentStatus: r.payment_status,
  }));
}

export const myOrders = (actor: Actor) => listOrders("o.buyer_id = ?", [actor.id], "seller");
export const sellerOrders = (actor: Actor) => listOrders("o.seller_id = ?", [actor.id], "buyer");

/** Order detail — only the buyer or the seller of this order (object-level authz). */
export async function getOrder(actor: Actor, id: string) {
  const o = await one<{
    id: string;
    code: string;
    buyer_id: string;
    seller_id: string;
    status: OrderStatus;
    payment_method: PaymentMethod;
    payment_status: PaymentStatus;
    total: number;
    recipient_name: string;
    recipient_phone: string;
    address: string;
    note: string;
    cancel_reason: string | null;
    created_at: string;
    buyer_name: string;
    shop_name: string;
    contact: string | null;
  }>(
    `SELECT o.*, b.full_name AS buyer_name, COALESCE(s.shop_name, sm.full_name) AS shop_name, s.contact
     FROM mkt_orders o JOIN members b ON b.id = o.buyer_id JOIN members sm ON sm.id = o.seller_id LEFT JOIN mkt_sellers s ON s.member_id = o.seller_id WHERE o.id = ?`,
    [id],
  );
  if (!o || (o.buyer_id !== actor.id && o.seller_id !== actor.id)) return null;
  const role = o.buyer_id === actor.id ? ("buyer" as const) : ("seller" as const);
  const items = await all<{ listing_id: string; title: string; unit_price: number; qty: number; reviewed: number; kind: ListingType; course_id: string | null; access_info: string; file_url: string; file_name: string }>(
    `SELECT i.listing_id, i.title, i.unit_price, i.qty, (SELECT COUNT(*) FROM mkt_reviews r WHERE r.order_id = i.order_id AND r.listing_id = i.listing_id) AS reviewed,
       l.kind, l.course_id, l.access_info, l.file_url, l.file_name
     FROM mkt_order_items i JOIN mkt_listings l ON l.id = i.listing_id WHERE i.order_id = ?`,
    [id],
  );
  const events = await all<{ to_status: string; note: string | null; created_at: string }>("SELECT to_status, note, created_at FROM mkt_order_events WHERE order_id = ? ORDER BY created_at", [id]);
  const state = { status: o.status, paymentMethod: o.payment_method, paymentStatus: o.payment_status };
  return {
    id: o.id,
    code: o.code,
    role,
    status: o.status,
    paymentMethod: o.payment_method,
    paymentStatus: o.payment_status,
    total: Number(o.total),
    recipientName: o.recipient_name,
    recipientPhone: o.recipient_phone,
    address: o.address,
    note: o.note,
    cancelReason: o.cancel_reason,
    createdAt: o.created_at,
    buyerName: o.buyer_name,
    shopName: o.shop_name,
    sellerContact: o.contact ?? "",
    items: items.map((i) => ({
      listingId: i.listing_id,
      title: i.title,
      unitPrice: Number(i.unit_price),
      qty: Number(i.qty),
      reviewed: Number(i.reviewed) > 0,
      // Digital file / access instructions / course link: the seller always, the buyer once the order is paid.
      access:
        (i.kind === "digital" || i.kind === "course") && (role === "seller" || digitalAccessOpen({ paymentStatus: o.payment_status, status: o.status }))
          ? { info: i.access_info, fileUrl: i.file_url, fileName: i.file_name, courseId: i.kind === "course" ? i.course_id : null }
          : null,
    })),
    events: events.map((e) => ({ status: e.to_status, note: e.note, at: e.created_at })),
    actions: availableActions(state, role),
    canReview: role === "buyer" && canReview(o.status),
  };
}

export async function orderAction(actor: Actor, orderId: string, action: OrderAction, reason?: string): Promise<OrderStatus> {
  const o = await one<{ buyer_id: string; seller_id: string; status: OrderStatus; payment_method: PaymentMethod; payment_status: PaymentStatus }>(
    "SELECT buyer_id, seller_id, status, payment_method, payment_status FROM mkt_orders WHERE id = ?",
    [orderId],
  );
  if (!o || (o.buyer_id !== actor.id && o.seller_id !== actor.id)) throw new ActionError("Không tìm thấy đơn hàng.");
  const role = o.buyer_id === actor.id ? "buyer" : "seller";
  const res = applyOrderAction({ status: o.status, paymentMethod: o.payment_method, paymentStatus: o.payment_status }, action, role, reason);
  if (!res.ok) throw new ActionError(res.error);
  await withTransaction(async (t) => {
    // Optimistic check: the status must still be what we validated against.
    const upd = await t.execute("UPDATE mkt_orders SET status = ?, payment_status = ?, cancel_reason = ?, updated_at = ? WHERE id = ? AND status = ?", [
      res.status,
      res.paymentStatus,
      action === "cancel" ? (reason?.trim() || "Người mua hủy") : null,
      now(),
      orderId,
      o.status,
    ]);
    if (upd.rowsAffected === 0) throw new ActionError("Đơn vừa được cập nhật bởi người khác. Tải lại và thử lại.");
    if (action === "cancel" && !(o.payment_method === "vnpay" && o.payment_status === "unpaid")) {
      const items = await t.execute("SELECT listing_id, qty FROM mkt_order_items WHERE order_id = ?", [orderId]);
      for (const i of items.rows) await t.execute("UPDATE mkt_listings SET stock = stock + ? WHERE id = ? AND stock IS NOT NULL", [Number(i.qty), String(i.listing_id)]);
    }
    await t.execute("INSERT INTO mkt_order_events (id, order_id, actor_id, from_status, to_status, note, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)", [
      randomUUID(),
      orderId,
      actor.id,
      o.status,
      action === "mark_paid" ? "paid" : res.status,
      reason?.trim() || null,
      now(),
    ]);
  });
  await audit(actor.id, `mkt.order.${action}`, `order:${orderId}`, "success");
  if (action === "cancel" && o.payment_method === "vnpay") {
    if (o.payment_status === "paid") await autoRefund("mkt_order", orderId, "order_cancelled", actor.id);
    else await releaseUnpaidVnpay(orderId); // payment never finished: give stock back now
  }
  // The other party is told what changed.
  const other = actor.id === o.buyer_id ? o.seller_id : o.buyer_id;
  const code = (await one<{ code: string }>("SELECT code FROM mkt_orders WHERE id = ?", [orderId]))?.code ?? "";
  const text: Record<OrderAction, string> = {
    confirm: "đã được người bán xác nhận",
    mark_paid: "đã được xác nhận thanh toán",
    ship: "đang được giao",
    deliver: "đã giao — bấm “Đã nhận hàng” khi bạn nhận đủ",
    complete: "đã hoàn tất",
    cancel: "đã bị hủy",
  };
  await notify(other, { category: "market", title: `Đơn #${code} ${text[action]}`, body: action === "cancel" && reason?.trim() ? `Lý do: ${reason.trim().slice(0, 200)}` : "", href: `/market/orders/${orderId}` });
  return res.status;
}

const reviewSchema = z.object({ rating: z.coerce.number().int().min(1, "Chọn số sao.").max(5), comment: z.string().trim().max(1000).default("") });

export async function reviewItem(actor: Actor, orderId: string, listingId: string, input: unknown): Promise<void> {
  const d = reviewSchema.parse(input);
  const o = await one<{ buyer_id: string; status: OrderStatus }>("SELECT buyer_id, status FROM mkt_orders WHERE id = ?", [orderId]);
  if (!o || o.buyer_id !== actor.id) throw new ActionError("Bạn chỉ đánh giá được đơn của mình.");
  if (!canReview(o.status)) throw new ActionError("Chỉ đánh giá sau khi đã nhận hàng.");
  const item = await one("SELECT 1 AS x FROM mkt_order_items WHERE order_id = ? AND listing_id = ?", [orderId, listingId]);
  if (!item) throw new ActionError("Sản phẩm không thuộc đơn này.");
  const dup = await one("SELECT 1 AS x FROM mkt_reviews WHERE order_id = ? AND listing_id = ?", [orderId, listingId]);
  if (dup) throw new ActionError("Bạn đã đánh giá sản phẩm này.");
  await run("INSERT INTO mkt_reviews (id, order_id, listing_id, buyer_id, rating, comment, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)", [
    randomUUID(),
    orderId,
    listingId,
    actor.id,
    d.rating,
    d.comment,
    now(),
  ]);
  await awardPoints(actor.id, "order_review", `${orderId}:${listingId}`);
}

/** SELL-01 dashboard figures (SELL-12 revenue = completed orders). */
export async function sellerStats(actor: Actor) {
  const r = await one<{ revenue: number; completed: number; open: number; listings: number; rating: number | null }>(
    `SELECT (SELECT COALESCE(SUM(total),0) FROM mkt_orders WHERE seller_id = ? AND status = 'completed') AS revenue,
            (SELECT COUNT(*) FROM mkt_orders WHERE seller_id = ? AND status = 'completed') AS completed,
            (SELECT COUNT(*) FROM mkt_orders WHERE seller_id = ? AND status IN ('placed','confirmed','shipping','delivered')) AS open,
            (SELECT COUNT(*) FROM mkt_listings WHERE seller_id = ? AND status = 'published') AS listings,
            (SELECT AVG(r.rating) FROM mkt_reviews r JOIN mkt_listings l ON l.id = r.listing_id WHERE l.seller_id = ?) AS rating`,
    [actor.id, actor.id, actor.id, actor.id, actor.id],
  );
  return {
    revenue: Number(r?.revenue ?? 0),
    completed: Number(r?.completed ?? 0),
    open: Number(r?.open ?? 0),
    listings: Number(r?.listings ?? 0),
    rating: r?.rating === null || r?.rating === undefined ? null : averageRating([Number(r.rating)]),
  };
}

/** PAY-01 for Marketplace: one VNPAY payment for the buyer's unpaid VNPAY orders (one per seller). */
export async function startOrderPayment(actor: Actor, orderIds: string[], ipAddr: string): Promise<{ payUrl: string; paymentId: string }> {
  if (!orderIds.length) throw new ActionError("Không có đơn cần thanh toán.");
  const rows = await all<{ id: string; seller_id: string; total: number; code: string; status: OrderStatus; payment_status: PaymentStatus; payment_method: PaymentMethod }>(
    `SELECT id, seller_id, total, code, status, payment_status, payment_method FROM mkt_orders WHERE buyer_id = ? AND id IN (${orderIds.map(() => "?").join(",")})`,
    [actor.id, ...orderIds],
  );
  const due = rows.filter((r) => r.payment_method === "vnpay" && r.payment_status === "unpaid" && r.status === "placed");
  if (due.length !== orderIds.length) throw new ActionError("Đơn không còn chờ thanh toán.");
  const newDue = new Date(Date.now() + PAYMENT_TTL_MIN * 60_000).toISOString();
  for (const r of due) await run("UPDATE mkt_orders SET payment_due_at = ?, updated_at = ? WHERE id = ?", [newDue, now(), r.id]);
  const pay = await createPayment(actor.id, {
    purpose: "mkt_checkout",
    description: `Đơn hàng ${due.map((r) => "#" + r.code).join(", ")}`.slice(0, 180),
    returnPath: due.length === 1 ? `/market/orders/${due[0].id}` : "/market/orders",
    items: due.map((r) => ({ refType: "mkt_order" as const, refId: r.id, payeeId: r.seller_id, amount: Number(r.total) })),
    ipAddr,
  });
  return { payUrl: pay.payUrl, paymentId: pay.id };
}

/** An unpaid VNPAY order that is cancelled or expires gives its stock back (idempotent via the event log). */
export async function releaseUnpaidVnpay(orderId: string): Promise<void> {
  const already = await one("SELECT 1 AS x FROM mkt_order_events WHERE order_id = ? AND to_status = 'stock_released'", [orderId]);
  if (already) return;
  await withTransaction(async (t) => {
    const items = await t.execute("SELECT listing_id, qty FROM mkt_order_items WHERE order_id = ?", [orderId]);
    for (const i of items.rows) await t.execute("UPDATE mkt_listings SET stock = stock + ? WHERE id = ? AND stock IS NOT NULL", [Number(i.qty), String(i.listing_id)]);
    await t.execute("INSERT INTO mkt_order_events (id, order_id, actor_id, from_status, to_status, note, created_at) VALUES (?, ?, 'system', NULL, 'stock_released', NULL, ?)", [randomUUID(), orderId, now()]);
  });
}

/** Job: VNPAY orders never paid (no payment started, or the page was abandoned) are cancelled after their deadline. */
export async function expireUnpaidOrders(): Promise<number> {
  const cutoff = new Date(Date.now() - 5 * 60_000).toISOString();
  const rows = await all<{ id: string }>(
    `SELECT o.id FROM mkt_orders o WHERE o.payment_method = 'vnpay' AND o.payment_status = 'unpaid' AND o.status = 'placed' AND o.payment_due_at < ?
       AND NOT EXISTS (SELECT 1 FROM payment_items i JOIN payments p ON p.id = i.payment_id WHERE i.ref_type = 'mkt_order' AND i.ref_id = o.id AND p.status = 'pending')`,
    [cutoff],
  );
  let n = 0;
  for (const r of rows) {
    const c = await run("UPDATE mkt_orders SET status = 'cancelled', cancel_reason = 'Chưa thanh toán trực tuyến', updated_at = ? WHERE id = ? AND status = 'placed' AND payment_status = 'unpaid'", [now(), r.id]);
    if (c !== 1) continue;
    await run("INSERT INTO mkt_order_events (id, order_id, actor_id, from_status, to_status, note, created_at) VALUES (?, ?, 'system', 'placed', 'cancelled', 'Hết hạn thanh toán', ?)", [randomUUID(), r.id, now()]);
    await releaseUnpaidVnpay(r.id);
    n += 1;
  }
  return n;
}

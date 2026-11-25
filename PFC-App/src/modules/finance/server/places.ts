import "server-only";
import { randomUUID } from "node:crypto";
import { z } from "zod";
import { audit } from "@/platform/audit";
import { assertAllowed } from "@/platform/admin/restrictions";
import { all, one, run } from "@/platform/db/client";
import { ActionError } from "@/platform/errors";
import { allowAttempt } from "@/platform/rate-limit";
import { can, type Actor } from "@/platform/roles";
import { verifyOwnUploadUrls } from "@/platform/uploads/service";
import { awardPoints } from "@/modules/rewards/server/service";

/**
 * "Ngon – Bổ – Rẻ" (FIN-26…34, mockups 32–36): budget-friendly places shared and reviewed by members.
 * All content comes from members; moderators (places.moderate) can hide abuse. Maps open in the member's
 * own map app via the address — PFC stores no coordinates and loads no map tiles.
 */
export const PLACE_CATEGORIES = { food: "Ăn uống", drink: "Cà phê & đồ uống", study: "Góc học tập", shopping: "Mua sắm", service: "Dịch vụ", other: "Khác" } as const;
export type PlaceCategory = keyof typeof PLACE_CATEGORIES;
export const PRICE_LEVEL = { 1: "Dưới 50.000₫", 2: "50.000–150.000₫", 3: "Trên 150.000₫" } as const;

const now = () => new Date().toISOString();

export type PlaceCard = { id: string; name: string; category: PlaceCategory; address: string; area: string; priceLevel: 1 | 2 | 3; coverUrl: string | null; rating: number | null; reviews: number; saved: boolean; hidden: boolean };

const CARD = `SELECT p.*, (SELECT AVG(rating) FROM fin_place_reviews r WHERE r.place_id = p.id) AS rating, (SELECT COUNT(*) FROM fin_place_reviews r WHERE r.place_id = p.id) AS reviews,
  EXISTS (SELECT 1 FROM fin_place_saves s WHERE s.place_id = p.id AND s.member_id = ?) AS saved FROM fin_places p`;
type CardRow = { id: string; name: string; category: PlaceCategory; address: string; area: string; price_level: 1 | 2 | 3; cover_url: string | null; rating: number | null; reviews: number; saved: number; hidden: number; author_id: string; description: string; hidden_reason: string | null; created_at: string };
const toCard = (r: CardRow): PlaceCard => ({
  id: r.id,
  name: r.name,
  category: r.category,
  address: r.address,
  area: r.area,
  priceLevel: Number(r.price_level) as 1 | 2 | 3,
  coverUrl: r.cover_url,
  rating: r.rating === null ? null : Math.round(Number(r.rating) * 10) / 10,
  reviews: Number(r.reviews),
  saved: !!r.saved,
  hidden: !!r.hidden,
});

export async function listPlaces(actor: Actor | null, f: { category?: string; q?: string; price?: string; sort?: "top" | "new"; saved?: boolean } = {}): Promise<PlaceCard[]> {
  const me = actor?.id ?? "";
  const where = ["p.hidden = 0"];
  const args: (string | number)[] = [me];
  if (f.category && f.category in PLACE_CATEGORIES) (where.push("p.category = ?"), args.push(f.category));
  if (f.price && ["1", "2", "3"].includes(f.price)) (where.push("p.price_level = ?"), args.push(Number(f.price)));
  if (f.saved) (where.push("EXISTS (SELECT 1 FROM fin_place_saves s WHERE s.place_id = p.id AND s.member_id = ?)"), args.push(me));
  if (f.q?.trim()) {
    const L = `%${f.q.trim().replace(/[\\%_]/g, (m) => `\\${m}`)}%`;
    where.push("(p.name LIKE ? ESCAPE '\\' OR p.address LIKE ? ESCAPE '\\' OR p.area LIKE ? ESCAPE '\\')");
    args.push(L, L, L);
  }
  const order = f.sort === "new" ? "p.created_at DESC" : "COALESCE(rating, 0) DESC, reviews DESC, p.created_at DESC";
  return (await all<CardRow>(`${CARD} WHERE ${where.join(" AND ")} ORDER BY ${order} LIMIT 100`, args)).map(toCard);
}

export type PlaceReview = { id: string; memberId: string; memberName: string; rating: number; comment: string; avgSpend: number | null; createdAt: string };

export async function getPlace(actor: Actor | null, id: string) {
  const r = await one<CardRow & { author_name: string }>(`${CARD.replace("FROM fin_places p", ", m.full_name AS author_name FROM fin_places p JOIN members m ON m.id = p.author_id")} WHERE p.id = ?`, [actor?.id ?? "", id]);
  if (!r) return null;
  const moderator = can(actor, "places.moderate");
  if (r.hidden && !moderator && r.author_id !== actor?.id) return null;
  const reviews = (
    await all<{ id: string; member_id: string; full_name: string; rating: number; comment: string; avg_spend: number | null; created_at: string }>(
      "SELECT r.id, r.member_id, m.full_name, r.rating, r.comment, r.avg_spend, r.created_at FROM fin_place_reviews r JOIN members m ON m.id = r.member_id WHERE r.place_id = ? ORDER BY r.created_at DESC LIMIT 100",
      [id],
    )
  ).map((x) => ({ id: x.id, memberId: x.member_id, memberName: x.full_name, rating: Number(x.rating), comment: x.comment, avgSpend: x.avg_spend === null ? null : Number(x.avg_spend), createdAt: x.created_at }));
  const spends = reviews.map((x) => x.avgSpend).filter((x): x is number => x !== null);
  return {
    ...toCard(r),
    description: r.description,
    authorId: r.author_id,
    authorName: r.author_name,
    hiddenReason: r.hidden_reason,
    reviewsList: reviews,
    avgSpend: spends.length ? Math.round(spends.reduce((a, b) => a + b, 0) / spends.length) : null,
    mine: reviews.find((x) => x.memberId === actor?.id) ?? null,
    isAuthor: r.author_id === actor?.id,
    canModerate: moderator,
  };
}

const placeSchema = z.object({
  name: z.string().trim().min(2, "Nhập tên địa điểm.").max(80),
  category: z.enum(Object.keys(PLACE_CATEGORIES) as [PlaceCategory, ...PlaceCategory[]]),
  address: z.string().trim().min(5, "Nhập địa chỉ cụ thể.").max(200),
  area: z.string().trim().max(60).default(""),
  priceLevel: z.coerce.number().int().min(1).max(3),
  description: z.string().trim().max(1000).default(""),
  coverUrl: z.string().nullable().optional(),
});

export async function savePlace(actor: Actor, id: string | null, input: unknown): Promise<string> {
  await assertAllowed(actor.id, "community", "places");
  const d = placeSchema.parse(input);
  const [cover] = d.coverUrl ? await verifyOwnUploadUrls(actor, "place", [d.coverUrl], 1) : [null];
  if (id) {
    const p = await one<{ author_id: string }>("SELECT author_id FROM fin_places WHERE id = ?", [id]);
    if (!p) throw new ActionError("Không tìm thấy địa điểm.");
    if (p.author_id !== actor.id) throw new ActionError("Chỉ người đăng sửa được địa điểm.");
    await run("UPDATE fin_places SET name = ?, category = ?, address = ?, area = ?, price_level = ?, description = ?, cover_url = ?, updated_at = ? WHERE id = ?", [d.name, d.category, d.address, d.area, d.priceLevel, d.description, cover ?? null, now(), id]);
    return id;
  }
  if (!(await allowAttempt(`place:${actor.id}`, 10, 24 * 3600_000))) throw new ActionError("Bạn đã thêm nhiều địa điểm hôm nay. Thử lại ngày mai.", "rate_limited");
  // SQLite lower() is ASCII-only, so Vietnamese capitals (Đ, Ơ…) are compared in JS.
  const norm = (s: string) => s.normalize("NFC").toLocaleLowerCase("vi").replace(/\s+/g, " ").trim();
  const dup = (await all<{ id: string; name: string; address: string }>("SELECT id, name, address FROM fin_places WHERE category = ? AND hidden = 0", [d.category])).find(
    (x) => norm(x.name) === norm(d.name) && norm(x.address) === norm(d.address),
  );
  if (dup) throw new ActionError("Địa điểm này đã có. Hãy vào đánh giá thay vì thêm mới.", "duplicate", { id: dup.id });
  const nid = randomUUID();
  await run(
    "INSERT INTO fin_places (id, author_id, name, category, address, area, price_level, description, cover_url, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
    [nid, actor.id, d.name, d.category, d.address, d.area, d.priceLevel, d.description, cover ?? null, now(), now()],
  );
  return nid;
}

const reviewSchema = z.object({
  rating: z.coerce.number().int().min(1, "Chọn số sao.").max(5),
  comment: z.string().trim().max(1000).default(""),
  avgSpend: z.preprocess((v) => (v === "" || v === null || v === undefined ? null : v), z.union([z.null(), z.coerce.number().int().min(0).max(100_000_000)])),
});

/** One review per member per place; writing again updates it. */
export async function reviewPlace(actor: Actor, placeId: string, input: unknown): Promise<void> {
  await assertAllowed(actor.id, "community", "places");
  const d = reviewSchema.parse(input);
  const p = await one<{ author_id: string; hidden: number }>("SELECT author_id, hidden FROM fin_places WHERE id = ?", [placeId]);
  if (!p || p.hidden) throw new ActionError("Không tìm thấy địa điểm.");
  await run(
    `INSERT INTO fin_place_reviews (id, place_id, member_id, rating, comment, avg_spend, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)
     ON CONFLICT(place_id, member_id) DO UPDATE SET rating = excluded.rating, comment = excluded.comment, avg_spend = excluded.avg_spend, created_at = excluded.created_at`,
    [randomUUID(), placeId, actor.id, d.rating, d.comment, d.avgSpend, now()],
  );
  if (d.comment.length >= 20) await awardPoints(actor.id, "place_review", placeId);
}

export async function deleteMyReview(actor: Actor, placeId: string): Promise<void> {
  await run("DELETE FROM fin_place_reviews WHERE place_id = ? AND member_id = ?", [placeId, actor.id]);
}

export async function toggleSavePlace(actor: Actor, placeId: string): Promise<boolean> {
  if (await run("DELETE FROM fin_place_saves WHERE place_id = ? AND member_id = ?", [placeId, actor.id])) return false;
  if (!(await one("SELECT 1 AS x FROM fin_places WHERE id = ? AND hidden = 0", [placeId]))) throw new ActionError("Không tìm thấy địa điểm.");
  await run("INSERT INTO fin_place_saves (place_id, member_id, created_at) VALUES (?, ?, ?)", [placeId, actor.id, now()]);
  return true;
}

/** Moderators hide (with a reason the author sees) or restore a place. */
export async function setPlaceHidden(actor: Actor, placeId: string, hidden: boolean, reason?: string): Promise<void> {
  if (!can(actor, "places.moderate")) throw new ActionError("Bạn không có quyền kiểm duyệt địa điểm.");
  if (hidden && !reason?.trim()) throw new ActionError("Cần ghi lý do ẩn.");
  const n = await run("UPDATE fin_places SET hidden = ?, hidden_reason = ?, updated_at = ? WHERE id = ?", [hidden ? 1 : 0, hidden ? reason!.trim().slice(0, 200) : null, now(), placeId]);
  if (!n) throw new ActionError("Không tìm thấy địa điểm.");
  await audit(actor.id, hidden ? "places.hide" : "places.restore", `place:${placeId}`, "success");
}

/** The author removes their own place (reviews go with it). */
export async function deletePlace(actor: Actor, placeId: string): Promise<void> {
  const p = await one<{ author_id: string }>("SELECT author_id FROM fin_places WHERE id = ?", [placeId]);
  if (!p) throw new ActionError("Không tìm thấy địa điểm.");
  if (p.author_id !== actor.id) throw new ActionError("Chỉ người đăng xóa được địa điểm.");
  await run("DELETE FROM fin_places WHERE id = ?", [placeId]);
}

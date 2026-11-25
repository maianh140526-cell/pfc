/**
 * Admin-editable settings (G7/G8). Pure: defaults and validation, unit tested.
 * The point values and tier thresholds below are PROPOSALS shown as such in the admin UI —
 * PFC confirms or edits them in Quản trị → Cấu hình; nothing here is a decided business rule.
 */
export const FLAGS = {
  community: { label: "Cộng đồng (bài viết, nhóm)", description: "Tắt = ẩn bảng tin và nhóm" },
  messages: { label: "Tin nhắn 1-1", description: "Tắt = không gửi tin nhắn mới" },
  events: { label: "Sự kiện", description: "Tắt = ẩn danh sách sự kiện và đăng ký" },
  places: { label: "Ngon – Bổ – Rẻ", description: "Địa điểm tiết kiệm do thành viên chia sẻ" },
  collab: { label: "Tìm cộng sự", description: "Hồ sơ cộng sự trong Dự án" },
  rewards: { label: "Điểm thưởng & hạng thành viên", description: "Tắt = không cộng điểm, ẩn đổi quà" },
} as const;
export type Flag = keyof typeof FLAGS;
export const DEFAULT_FLAGS: Record<Flag, boolean> = { community: true, messages: true, events: true, places: true, collab: true, rewards: true };

/** Actions that can earn points. `cap` = max times per day (null = unlimited, still once per reference). */
export const RULES = {
  course_complete: { label: "Hoàn thành khóa học", points: 50, cap: null },
  quiz_pass: { label: "Đạt bài kiểm tra", points: 20, cap: 5 },
  event_checkin: { label: "Check-in sự kiện", points: 30, cap: null },
  post_create: { label: "Đăng bài cộng đồng", points: 5, cap: 3 },
  place_review: { label: "Đánh giá địa điểm", points: 5, cap: 3 },
  order_review: { label: "Đánh giá sản phẩm đã mua", points: 5, cap: 5 },
  referral: { label: "Giới thiệu bạn bè (bạn mới hoàn tất hồ sơ)", points: 100, cap: null },
} as const;
export type RuleKey = keyof typeof RULES;
export type RuleConfig = { points: number; cap: number | null; enabled: boolean };
export const DEFAULT_RULES: Record<RuleKey, RuleConfig> = Object.fromEntries(
  (Object.keys(RULES) as RuleKey[]).map((k) => [k, { points: RULES[k].points, cap: RULES[k].cap, enabled: true }]),
) as Record<RuleKey, RuleConfig>;

/** Tiers by lifetime earned points (redeeming never lowers a tier). */
export type Tier = { key: string; label: string; min: number; benefits: string };
export const DEFAULT_TIERS: Tier[] = [
  { key: "member", label: "Thành viên", min: 0, benefits: "Tích điểm khi học, tham gia sự kiện, đóng góp cộng đồng." },
  { key: "silver", label: "Bạc", min: 500, benefits: "Huy hiệu Bạc trên hồ sơ." },
  { key: "gold", label: "Vàng", min: 2000, benefits: "Huy hiệu Vàng trên hồ sơ." },
  { key: "diamond", label: "Kim cương", min: 5000, benefits: "Huy hiệu Kim cương trên hồ sơ." },
];

/** Marketplace risk caps for sellers that are not yet verified (proposal, editable by the Chủ nhiệm). */
export type MarketLimits = { basicMaxPrice: number; basicMaxListings: number };
export const DEFAULT_MARKET: MarketLimits = { basicMaxPrice: 2_000_000, basicMaxListings: 10 };
export function validateMarket(m: MarketLimits): string | null {
  if (!Number.isInteger(m.basicMaxPrice) || m.basicMaxPrice < 10_000 || m.basicMaxPrice > 100_000_000) return "Giá tối đa phải từ 10.000₫ đến 100.000.000₫.";
  if (!Number.isInteger(m.basicMaxListings) || m.basicMaxListings < 1 || m.basicMaxListings > 200) return "Số tin tối đa phải từ 1 đến 200.";
  return null;
}

export function tierFor(lifetime: number, tiers: Tier[]): { current: Tier; next: Tier | null; progress: number } {
  const sorted = [...tiers].sort((a, b) => a.min - b.min);
  let i = 0;
  for (let k = 0; k < sorted.length; k++) if (lifetime >= sorted[k].min) i = k;
  const current = sorted[i];
  const next = sorted[i + 1] ?? null;
  const progress = next ? Math.min(1, (lifetime - current.min) / (next.min - current.min)) : 1;
  return { current, next, progress };
}

export function validateTiers(t: Tier[]): string | null {
  if (t.length < 1 || t.length > 8) return "Cần 1–8 hạng.";
  const sorted = [...t].sort((a, b) => a.min - b.min);
  if (sorted[0].min !== 0) return "Hạng thấp nhất phải bắt đầu từ 0 điểm.";
  if (new Set(t.map((x) => x.min)).size !== t.length) return "Mốc điểm các hạng không được trùng.";
  if (new Set(t.map((x) => x.key)).size !== t.length) return "Mã hạng không được trùng.";
  if (t.some((x) => !x.label.trim() || !/^[a-z0-9_]{2,20}$/.test(x.key) || !Number.isInteger(x.min) || x.min < 0)) return "Tên / mã / mốc điểm không hợp lệ.";
  return null;
}

export function validateRules(r: Record<string, RuleConfig>): string | null {
  for (const k of Object.keys(RULES)) {
    const x = r[k];
    if (!x) return `Thiếu quy tắc ${k}.`;
    if (!Number.isInteger(x.points) || x.points < 0 || x.points > 10_000) return `Điểm của “${RULES[k as RuleKey].label}” phải là số nguyên 0–10.000.`;
    if (x.cap !== null && (!Number.isInteger(x.cap) || x.cap < 1 || x.cap > 100)) return `Giới hạn/ngày của “${RULES[k as RuleKey].label}” phải 1–100 hoặc bỏ trống.`;
  }
  return null;
}

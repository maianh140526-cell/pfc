import type { HubSlug } from "@/domain/hubs";

/** Onboarding interests (mockup 7) → which branch they bring to the top of Home. */
export const INTERESTS = {
  finance: { label: "Quản lý tài chính", description: "Ngân sách, tiết kiệm, theo dõi chi tiêu", hub: "finance" },
  learn: { label: "Học kỹ năng mới", description: "Khóa học, bài kiểm tra, tài liệu", hub: "learn" },
  opportunities: { label: "Tìm cơ hội", description: "Việc làm, thực tập, học bổng, cuộc thi", hub: "opportunities" },
  community: { label: "Tham gia cộng đồng", description: "Câu lạc bộ, hoạt động, người cùng chí hướng", hub: "club" },
  projects: { label: "Làm dự án thật", description: "Tìm đồng đội, mentor, ra sản phẩm", hub: "projects" },
  shop: { label: "Mua bán & hỗ trợ", description: "Sách, dịch vụ, khóa học, sự kiện", hub: "marketplace" },
} as const satisfies Record<string, { label: string; description: string; hub: HubSlug }>;
export type Interest = keyof typeof INTERESTS;

/** Language (mockup 270). Only Vietnamese is translated today; others are listed as coming. */
export const LOCALES = ["vi", "en"] as const;
export type Locale = (typeof LOCALES)[number];

/** Privacy (mockup 272). Only options the app actually enforces. */
export type Privacy = {
  /** Who sees me in "Mọi người" search results: signed-in members, or nobody. */
  profileVisibility: "members" | "private";
  /** Can others find me by exact email (e.g. project invites)? */
  findByEmail: boolean;
  /** Who can start a direct conversation with me. */
  messages: "members" | "following" | "none";
};
export const PRIVACY_DEFAULTS: Privacy = { profileVisibility: "members", findByEmail: true, messages: "members" };

/** Orders hubs so the member's interests come first (stable otherwise). */
export function orderHubsByInterest<T extends { slug: HubSlug }>(hubs: readonly T[], interests: readonly string[]): T[] {
  const wanted = new Set(interests.map((i) => (INTERESTS as Record<string, { hub: HubSlug }>)[i]?.hub).filter(Boolean));
  return [...hubs].sort((a, b) => Number(wanted.has(b.slug)) - Number(wanted.has(a.slug)));
}

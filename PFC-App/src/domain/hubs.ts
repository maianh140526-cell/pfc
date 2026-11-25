/**
 * The six PFC Digital Hub branches (SRS §3.1) as shown on Home → "Khám phá".
 * `phase` follows the rollout in MOBILE_WEB_APP.md §6. Routes for hubs that are not yet
 * inside the shell point at /hub/<slug> (a "coming soon" screen).
 */
export type HubSlug = "finance" | "learn" | "projects" | "marketplace" | "opportunities" | "club";

export type Hub = {
  slug: HubSlug;
  title: string;
  subtitle: string;
  href: string;
  /** Where the module lives today, if anywhere. */
  currentHome?: string;
  phase: string;
  /** Has its own interior in this app (own layout + tab bar). */
  ready: boolean;
};

export const HUBS: readonly Hub[] = [
  {
    slug: "finance",
    title: "Tài chính",
    subtitle: "Thu chi, ngân sách, tiết kiệm",
    href: "/finance",
    currentHome: "PFC-Personal Finance (Flutter)",
    phase: "P3",
    ready: true,
  },
  { slug: "learn", title: "Học tập", subtitle: "Khóa học, kiểm tra, diễn đàn", href: "/learn", phase: "P6", ready: true },
  { slug: "projects", title: "Dự án", subtitle: "Ý tưởng, cộng sự, mentor", href: "/projects", phase: "P6", ready: true },
  { slug: "marketplace", title: "Marketplace", subtitle: "Mua bán sách, dịch vụ, khóa học", href: "/market", phase: "P6", ready: true },
  {
    slug: "opportunities",
    title: "Cơ hội",
    subtitle: "Thực tập, việc làm, học bổng",
    href: "/opportunities",
    currentHome: "PFC-Opportunity Hub/web",
    phase: "P4",
    ready: true,
  },
  {
    slug: "club",
    title: "Câu lạc bộ",
    subtitle: "Thành viên, công việc, hoạt động",
    href: "/club",
    currentHome: "PFC-Management/apps/club",
    phase: "P4",
    ready: true,
  },
];

export function findHub(slug: string): Hub | undefined {
  return HUBS.find((h) => h.slug === slug);
}

/**
 * PFC Digital Hub — 6 strategic branches on Lobby.
 *
 * Đã có module trong monorepo (3):
 *  01 Personal Finance  → PFC-Personal Finance (Flutter)
 *  05 Opportunity       → PFC-Opportunity Hub/web
 *  06 Club Management   → PFC-Management/apps/club
 *
 * Chưa có folder riêng (3): Education · Project · Marketplace
 */

export type HubBranch = {
  id: string;
  slug: string;
  title: string;
  subtitle: string;
  icon: string;
  tone: string;
  /** Module đã có trong repo và mở được */
  ready: boolean;
  /** internal = route trong Club; external = mở app module khác */
  open: "internal" | "external" | "soon";
  internalPath?: string;
  /** Env NEXT_PUBLIC_* chứa absolute URL */
  originEnv?: string;
  defaultOrigin?: string;
  modulePath: string;
  runHint: string;
};

export const HUB_BRANCHES: HubBranch[] = [
  {
    id: "01",
    slug: "personal-finance",
    title: "Personal Finance",
    subtitle: "Quỹ · thu chi · mục tiêu",
    icon: "💰",
    tone: "amber",
    ready: true,
    open: "external",
    originEnv: "NEXT_PUBLIC_HUB_FINANCE_URL",
    defaultOrigin: "http://127.0.0.1:8080",
    modulePath: "PFC-Personal Finance",
    runHint:
      'Cài Flutter SDK rồi chạy:\ncd "PFC-Personal Finance"\nflutter pub get\nflutter run -d web-server --web-port=8080 --web-hostname=127.0.0.1',
  },
  {
    id: "02",
    slug: "education",
    title: "Education",
    subtitle: "LEARN · học & workshop",
    icon: "📚",
    tone: "sky",
    ready: false,
    open: "soon",
    modulePath: "(chưa có folder)",
    runHint: "Module Education chưa có trong monorepo.",
  },
  {
    id: "03",
    slug: "project",
    title: "Project",
    subtitle: "BUILD · dự án thực chiến",
    icon: "🛠️",
    tone: "emerald",
    ready: false,
    open: "soon",
    modulePath: "(chưa có folder)",
    runHint: "Module Project chưa có trong monorepo.",
  },
  {
    id: "04",
    slug: "marketplace",
    title: "Marketplace",
    subtitle: "EARN · cơ hội giao dịch",
    icon: "🛒",
    tone: "rose",
    ready: false,
    open: "soon",
    modulePath: "(chưa có folder)",
    runHint: "Module Marketplace chưa có trong monorepo.",
  },
  {
    id: "05",
    slug: "opportunity",
    title: "Opportunity",
    subtitle: "GROW · việc & mentor",
    icon: "🚀",
    tone: "indigo",
    ready: true,
    open: "external",
    originEnv: "NEXT_PUBLIC_HUB_OPPORTUNITY_URL",
    defaultOrigin: "http://127.0.0.1:3001",
    modulePath: "PFC-Opportunity Hub/web",
    runHint: 'cd "PFC-Opportunity Hub/web" && npm install && npm run dev',
  },
  {
    id: "06",
    slug: "club-management",
    title: "Club Management",
    subtitle: "MANAGE · vận hành CLB",
    icon: "🏛️",
    tone: "violet",
    ready: true,
    open: "internal",
    internalPath: "/manage",
    modulePath: "PFC-Management/apps/club",
    runHint: "Đang chạy trong app Club (npm run dev).",
  },
];

export function hubBySlug(slug: string): HubBranch | undefined {
  return HUB_BRANCHES.find((h) => h.slug === slug);
}

/** Lobby href for each branch card */
export function hubLobbyHref(branch: HubBranch): string {
  if (branch.open === "internal" && branch.internalPath) {
    return branch.internalPath;
  }
  return `/hubs/${branch.slug}`;
}

/**
 * Resolve public origin for external modules.
 * NEXT_PUBLIC_* must be referenced statically for client bundle inlining.
 */
export function hubOrigin(branch: HubBranch): string {
  let fromEnv = "";
  if (branch.originEnv === "NEXT_PUBLIC_HUB_FINANCE_URL") {
    fromEnv = process.env.NEXT_PUBLIC_HUB_FINANCE_URL ?? "";
  } else if (branch.originEnv === "NEXT_PUBLIC_HUB_OPPORTUNITY_URL") {
    fromEnv = process.env.NEXT_PUBLIC_HUB_OPPORTUNITY_URL ?? "";
  }
  const raw = (fromEnv || branch.defaultOrigin || "").trim();
  return raw.replace(/\/$/, "");
}

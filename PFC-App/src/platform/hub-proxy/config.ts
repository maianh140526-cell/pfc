/**
 * Same-origin gateway to hub backends that still run as their own services (ADR-010).
 * Pure config + path policy so it can be unit tested.
 */
export type HubId = "opp" | "club";

export type HubConfig = {
  origin: () => string;
  /** Upstream path for the given sub-path segments, or null if not allowed. */
  upstreamPath: (segments: readonly string[]) => string | null;
  /** Query-level deny list, e.g. maintenance actions that must never be reachable from the app. */
  blocked?: (search: URLSearchParams) => boolean;
  /** POST body `action` values that are never forwarded. */
  blockedActions?: readonly string[];
  /** The only cookie forwarded to / accepted from this hub. */
  cookie: string;
  name: string;
  /** Platform SSO exchange: hub endpoint, token audience, shared secret (ADR-011). */
  sso: { path: string; audience: string; secret: () => string };
};

const SEGMENT = /^[A-Za-z0-9_-]{1,64}$/;

/** Opportunity Hub member/provider/reviewer APIs. `jobs/*` (cron, needs CRON_SECRET) is never exposed. */
const OPP_ALLOWED_ROOTS = new Set(["auth", "opportunities", "me", "provider", "reviewer", "attachments", "cv"]);

export const HUB_CONFIG: Record<HubId, HubConfig> = {
  opp: {
    name: "Cơ hội",
    cookie: "pfc_opp_session",
    sso: { path: "/api/auth/sso", audience: "pfc-opportunity", secret: () => process.env.OPP_SSO_SECRET ?? "" },
    origin: () => process.env.OPP_API_ORIGIN || "http://127.0.0.1:3001",
    upstreamPath: (segs) => {
      if (segs.length === 0 || !OPP_ALLOWED_ROOTS.has(segs[0])) return null;
      // One account: password login/SSO to Opportunity happen only via the gateway itself.
      if (segs[0] === "auth" && segs[1] !== "me") return null;
      if (!segs.every((s) => SEGMENT.test(s))) return null;
      return `/api/${segs.join("/")}`;
    },
  },
  club: {
    name: "Câu lạc bộ",
    cookie: "pfc_club_session",
    sso: { path: "/api/club/sso/session", audience: "pfc-club", secret: () => process.env.CLUB_SSO_SECRET ?? "" },
    origin: () => process.env.CLUB_API_ORIGIN || "http://127.0.0.1:3000",
    // Club exposes a single action endpoint: GET|POST /api/club?action=…
    upstreamPath: (segs) => (segs.length === 0 ? "/api/club" : null),
    // bootstrap re-seeds demo data without auth; run_jobs/metrics are operator-only.
    blocked: (q) => ["bootstrap", "run_jobs", "metrics"].includes(q.get("action") ?? ""),
    // POST bodies: password login and SSO start are platform-only (see ADR-011).
    blockedActions: ["login", "sso_start", "google_start", "run_jobs", "bootstrap"],
  },
};

export function isHubId(v: string): v is HubId {
  return v === "opp" || v === "club";
}

/** Extracts just one named cookie from a Cookie header. */
export function pickCookie(header: string | null, name: string): string | null {
  if (!header) return null;
  for (const part of header.split(";")) {
    const [k, ...v] = part.trim().split("=");
    if (k === name) return `${name}=${v.join("=")}`;
  }
  return null;
}

/** Keeps a Set-Cookie only if it sets the hub's own cookie; strips any Domain attribute. */
export function filterSetCookie(setCookie: string, name: string): string | null {
  const first = setCookie.split(";")[0] ?? "";
  if (first.split("=")[0]?.trim() !== name) return null;
  return setCookie
    .split(";")
    .filter((attr) => !/^\s*domain=/i.test(attr))
    .join(";");
}

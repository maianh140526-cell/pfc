/**
 * Opportunities from outside the Opportunity hub: public job feeds, UEB announcements and posts by PFC leaders.
 * Pure parsing and status rules (no I/O), unit tested. The fetching lives in server/sources.ts.
 */
export const EXT_TYPES = ["internship", "job", "competition", "scholarship"] as const;
export type ExtType = (typeof EXT_TYPES)[number];
export const EXT_TYPE_LABEL: Record<ExtType, string> = { internship: "Thực tập", job: "Việc làm", competition: "Cuộc thi", scholarship: "Học bổng" };

export const SOURCES = {
  ueb: { label: "Trường ĐH Kinh tế (UEB)", url: "https://ueb.edu.vn", note: "Thông báo học bổng, tuyển dụng, cuộc thi của UEB" },
  remoteok: { label: "Remote OK", url: "https://remoteok.com", note: "Việc làm từ xa quốc tế" },
  wwr: { label: "We Work Remotely", url: "https://weworkremotely.com", note: "Việc làm từ xa quốc tế" },
  pfc: { label: "PFC", url: "", note: "Do Ban điều hành / Trưởng ban PFC đăng" },
} as const;
export type SourceId = keyof typeof SOURCES;
export const isSourceId = (v: unknown): v is SourceId => typeof v === "string" && v in SOURCES;

/** Websites we only link to (no data is copied): their terms or bot protection do not allow it. */
export const LINK_ONLY_SOURCES = [
  { label: "Upwork", url: "https://www.upwork.com/nx/search/jobs/", note: "Việc freelance. Upwork không cho sao chép tin tự động, hãy mở trực tiếp." },
  { label: "Cổng việc làm sinh viên UEB", url: "https://ueb.edu.vn", note: "Trang chính của UEB" },
] as const;

export type ParsedItem = {
  source: SourceId;
  externalId: string;
  type: ExtType;
  title: string;
  summary: string;
  organization: string;
  location: string;
  imageUrl: string;
  url: string;
  postedAt: string | null;
  deadlineAt: string | null;
};

const ENTITIES: Record<string, string> = { amp: "&", lt: "<", gt: ">", quot: '"', apos: "'", nbsp: " " };
export function decodeEntities(s: string): string {
  return s.replace(/&(#x?[0-9a-f]+|[a-z]+);/gi, (m, e: string) => {
    if (e[0] === "#") {
      const n = e[1].toLowerCase() === "x" ? parseInt(e.slice(2), 16) : parseInt(e.slice(1), 10);
      return Number.isFinite(n) && n > 0 && n < 0x110000 ? String.fromCodePoint(n) : m;
    }
    return ENTITIES[e.toLowerCase()] ?? m;
  });
}

/** Plain text from HTML, collapsed and cut at a word boundary. Never returns markup. */
export function toPlainText(html: string, max = 300): string {
  const text = decodeEntities(decodeEntities(html).replace(/<(script|style)[\s\S]*?<\/\1>/gi, " ").replace(/<[^>]*>/g, " "))
    .replace(/\s+/g, " ")
    .trim();
  if (text.length <= max) return text;
  const cut = text.slice(0, max);
  return cut.slice(0, Math.max(cut.lastIndexOf(" "), max - 40)).trimEnd() + "…";
}

/** Only https URLs are kept (links and images shown in the app). */
export function safeHttpsUrl(u: unknown): string {
  if (typeof u !== "string") return "";
  try {
    const x = new URL(u.trim());
    return x.protocol === "https:" ? x.toString() : "";
  } catch {
    return "";
  }
}

const iso = (d: Date) => (Number.isNaN(d.getTime()) ? null : d.toISOString());

// ───────────────────────── Remote OK ─────────────────────────

export function parseRemoteOk(json: unknown, limit = 40): ParsedItem[] {
  if (!Array.isArray(json)) return [];
  const out: ParsedItem[] = [];
  for (const j of json as Array<Record<string, unknown>>) {
    if (!j || typeof j !== "object" || typeof j.id !== "string" && typeof j.id !== "number") continue;
    const title = typeof j.position === "string" ? toPlainText(j.position, 160) : "";
    const url = safeHttpsUrl(j.url);
    if (!title || !url) continue;
    const tags = Array.isArray(j.tags) ? (j.tags as unknown[]).filter((t): t is string => typeof t === "string").slice(0, 4) : [];
    const epoch = typeof j.epoch === "number" ? j.epoch * 1000 : Date.parse(String(j.date ?? ""));
    out.push({
      source: "remoteok",
      externalId: String(j.id),
      type: "job",
      title,
      summary: toPlainText(typeof j.description === "string" ? j.description : "", 280),
      organization: typeof j.company === "string" ? toPlainText(j.company, 80) : "",
      location: [typeof j.location === "string" ? j.location : "Remote", ...tags].filter(Boolean).join(" · ").slice(0, 120),
      imageUrl: safeHttpsUrl(j.company_logo) || safeHttpsUrl(j.logo),
      url,
      postedAt: Number.isFinite(epoch) ? iso(new Date(epoch)) : null,
      deadlineAt: null,
    });
    if (out.length >= limit) break;
  }
  return out;
}

// ───────────────────────── We Work Remotely (RSS) ─────────────────────────

const tag = (xml: string, name: string) => {
  const m = new RegExp(`<${name}[^>]*>([\\s\\S]*?)</${name}>`, "i").exec(xml);
  if (!m) return "";
  return m[1].replace(/^\s*<!\[CDATA\[([\s\S]*?)\]\]>\s*$/, "$1").trim();
};

export function parseWwrRss(xml: string, limit = 40): ParsedItem[] {
  const out: ParsedItem[] = [];
  for (const m of xml.matchAll(/<item>([\s\S]*?)<\/item>/gi)) {
    const it = m[1];
    const rawTitle = decodeEntities(tag(it, "title"));
    const url = safeHttpsUrl(decodeEntities(tag(it, "link")) || decodeEntities(tag(it, "guid")));
    if (!rawTitle || !url) continue;
    const [company, ...rest] = rawTitle.split(": ");
    const title = rest.length ? rest.join(": ") : rawTitle;
    const media = /<media:content[^>]*url="([^"]+)"/i.exec(it)?.[1] ?? "";
    out.push({
      source: "wwr",
      externalId: url.split("/").pop() || url,
      type: "job",
      title: toPlainText(title, 160),
      summary: toPlainText(tag(it, "description"), 280),
      organization: rest.length ? toPlainText(company, 80) : "",
      location: [tag(it, "region"), tag(it, "type")].map((x) => decodeEntities(x)).filter(Boolean).join(" · ").slice(0, 120),
      imageUrl: safeHttpsUrl(decodeEntities(media)),
      url,
      postedAt: iso(new Date(tag(it, "pubDate"))),
      deadlineAt: tag(it, "expires_at") ? iso(new Date(tag(it, "expires_at"))) : null,
    });
    if (out.length >= limit) break;
  }
  return out;
}

// ───────────────────────── UEB announcements ─────────────────────────

const UEB_HOST = "ueb.edu.vn";
const UEB_KEYWORDS: Array<[RegExp, ExtType]> = [
  [/hoc-bong/, "scholarship"],
  [/cuoc-thi|olympic|hackathon|thi-tai-nang/, "competition"],
  [/thuc-tap/, "internship"],
  [/tuyen-dung|viec-lam|tuyen-cong-tac-vien|job-fair|ngay-hoi-viec-lam/, "job"],
];

/** Article links (absolute, https, UEB host only) that look like an opportunity, from a list page. */
export function uebOpportunityLinks(html: string, base = `https://${UEB_HOST}/`): Array<{ url: string; type: ExtType }> {
  const seen = new Set<string>();
  const out: Array<{ url: string; type: ExtType }> = [];
  // Article links look like /Tin-Tuc/UEB/<slug>/<id> or /Sinh-Vien-Hoc-Vien/UEB/<slug>/1777/0/0/<id>; the id is the last segment.
  for (const m of html.matchAll(/href="([^"#]*(?:Tin-Tuc|Sinh-Vien-Hoc-Vien|Dao-Tao)\/[A-Za-z-]+\/[^"#]+\/\d{3,})"/g)) {
    let url: URL;
    try {
      url = new URL(decodeEntities(m[1]), base);
    } catch {
      continue;
    }
    if (url.protocol !== "https:" || url.hostname !== UEB_HOST || seen.has(url.pathname)) continue;
    seen.add(url.pathname);
    const slug = decodeURIComponent(url.pathname).normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
    const hit = UEB_KEYWORDS.find(([re]) => re.test(slug));
    if (hit) out.push({ url: url.toString(), type: hit[1] });
  }
  return out;
}

/** UEB article id = last numeric path segment. */
export function uebArticleId(url: string): string | null {
  try {
    return /\/(\d{3,})\/?$/.exec(new URL(url).pathname)?.[1] ?? null;
  } catch {
    return null;
  }
}

const meta = (html: string, prop: string) => {
  const m = new RegExp(`<meta[^>]+property="${prop}"[^>]+content="([^"]*)"`, "i").exec(html) ?? new RegExp(`<meta[^>]+content="([^"]*)"[^>]+property="${prop}"`, "i").exec(html);
  return m ? decodeEntities(m[1]) : "";
};

/** Last "hạn … dd/mm/yyyy" style date in the article (deadline for applications), as an ISO date at end of day (+07). */
export function findDeadline(text: string): string | null {
  const re = /(?:h[aạ]n(?:\s+(?:ch[oó]t|cu[oố]i|n[oộ]p|đ[aă]ng\s+k[yý]|ứng\s+tuy[eể]n|nh[aậ]p\s+h[oọ]c))?[^0-9<]{0,40}?|deadline[^0-9<]{0,20}?|trước\s+(?:ngày\s+)?)(\d{1,2})[/.-](\d{1,2})[/.-](\d{4})/gi;
  let last: string | null = null;
  for (const m of text.matchAll(re)) {
    const [d, mo, y] = [Number(m[1]), Number(m[2]), Number(m[3])];
    if (d < 1 || d > 31 || mo < 1 || mo > 12 || y < 2000 || y > 2100) continue;
    last = new Date(Date.UTC(y, mo - 1, d, 16, 59, 59)).toISOString(); // 23:59:59 at UTC+7
  }
  return last;
}

export function parseUebArticle(html: string, url: string, type: ExtType): ParsedItem | null {
  const title = toPlainText(meta(html, "og:title") || /<title>([^<]*)<\/title>/i.exec(html)?.[1] || "", 200);
  const id = uebArticleId(url);
  if (!title || !id) return null;
  const body = toPlainText(html.replace(/<head[\s\S]*?<\/head>/i, ""), 20000);
  const published = /(\d{1,2})\/(\d{1,2})\/(\d{4})/.exec(/(?:Ngày đăng|Đăng ngày)[^0-9]{0,20}([0-9/]{8,10})/i.exec(body)?.[0] ?? "");
  return {
    source: "ueb",
    externalId: id,
    type,
    title,
    summary: toPlainText(meta(html, "og:description"), 280),
    organization: "Trường Đại học Kinh tế - ĐHQGHN",
    location: "Hà Nội",
    imageUrl: safeHttpsUrl(decodeEntities(meta(html, "og:image"))),
    url,
    postedAt: published ? new Date(Date.UTC(Number(published[3]), Number(published[2]) - 1, Number(published[1]))).toISOString() : null,
    deadlineAt: findDeadline(body),
  };
}

// ───────────────────────── Status ─────────────────────────

export type OppState = { code: "open" | "closing" | "closed"; label: string; tone: "income" | "warning" | "expense" | "muted" };

/**
 * What the member sees about a posting: still open, closing soon (within 7 days) or closed
 * (deadline passed, closed by the poster, or gone from its source for a while).
 */
export function stateOf(o: { state: "open" | "closed"; deadlineAt: string | null }, now = Date.now()): OppState {
  if (o.state === "closed") return { code: "closed", label: "Đã đóng", tone: "expense" };
  if (!o.deadlineAt) return { code: "open", label: "Đang mở", tone: "income" };
  const ms = Date.parse(o.deadlineAt) - now;
  if (ms <= 0) return { code: "closed", label: "Hết hạn", tone: "expense" };
  const days = Math.ceil(ms / 86_400_000);
  return days <= 7 ? { code: "closing", label: days <= 1 ? "Hết hạn hôm nay / ngày mai" : `Còn ${days} ngày`, tone: "warning" } : { code: "open", label: `Còn ${days} ngày`, tone: "income" };
}

/** A feed posting not seen in its source for this long is treated as closed. */
export const GONE_AFTER_DAYS = 14;
export const REFRESH_EVERY_MS = 6 * 3_600_000;

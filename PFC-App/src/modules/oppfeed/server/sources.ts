import "server-only";
import { parseRemoteOk, parseUebArticle, parseWwrRss, uebArticleId, uebOpportunityLinks, type ParsedItem } from "../domain/feed";

/**
 * Fetches public pages for the opportunity feed. Only fixed https URLs on known hosts are requested (no URL from
 * user input), responses are size-capped and time-limited, and a failing source never breaks the others.
 * Be polite: the refresh runs at most every few hours (see service.ts) and identifies itself.
 */
const UA = "PFCHubBot/1.0 (opportunity feed; refreshes a few times a day)";
const MAX_BYTES = 4 * 1024 * 1024;

async function getText(url: string, host: string, accept: string): Promise<string | null> {
  try {
    const res = await fetch(url, { headers: { "user-agent": UA, accept }, signal: AbortSignal.timeout(15_000), redirect: "follow", cache: "no-store" });
    if (!res.ok || new URL(res.url).hostname !== host) return null;
    const buf = await res.arrayBuffer();
    if (buf.byteLength > MAX_BYTES) return null;
    return new TextDecoder("utf-8").decode(buf);
  } catch {
    return null;
  }
}

export type SourceRun = { source: string; ok: boolean; items: ParsedItem[] };

export async function fetchRemoteOk(): Promise<SourceRun> {
  const text = await getText("https://remoteok.com/api", "remoteok.com", "application/json");
  try {
    return { source: "remoteok", ok: !!text, items: text ? parseRemoteOk(JSON.parse(text), 30) : [] };
  } catch {
    return { source: "remoteok", ok: false, items: [] };
  }
}

const WWR_FEEDS = ["remote-sales-and-marketing-jobs", "remote-design-jobs"];

export async function fetchWwr(): Promise<SourceRun> {
  const items: ParsedItem[] = [];
  let ok = false;
  for (const f of WWR_FEEDS) {
    const xml = await getText(`https://weworkremotely.com/categories/${f}.rss`, "weworkremotely.com", "application/rss+xml");
    if (xml) {
      ok = true;
      items.push(...parseWwrRss(xml, 15));
    }
  }
  return { source: "wwr", ok, items };
}

const UEB_LISTS = [
  "https://ueb.edu.vn/",
  "https://ueb.edu.vn/Tin-Tuc/THONG-BAO/1658",
  "https://ueb.edu.vn/Tin-Tuc/SU-KIEN/1657",
  "https://ueb.edu.vn/Tin-Tuc/TIN-TUC-CHUNG/1659",
  "https://ueb.edu.vn/Sinh-Vien-Hoc-Vien/SINH-VIEN/1777",
  "https://ueb.edu.vn/Sinh-Vien-Hoc-Vien/HOC-VIEN---NGHIEN-CUU-SINH/1778",
  "https://ueb.edu.vn/Dao-Tao/Hoc-Ki-Quoc-Te/2240",
];

/** `known` = UEB article ids already stored; only new articles are fetched (at most `maxNew` per run). */
export async function fetchUeb(known: Set<string>, maxNew = 8): Promise<SourceRun> {
  const found = new Map<string, { url: string; type: ReturnType<typeof uebOpportunityLinks>[number]["type"] }>();
  let ok = false;
  for (const list of UEB_LISTS) {
    const html = await getText(list, "ueb.edu.vn", "text/html");
    if (!html) continue;
    ok = true;
    for (const l of uebOpportunityLinks(html)) {
      const id = uebArticleId(l.url);
      if (id) found.set(id, l);
    }
  }
  const items: ParsedItem[] = [];
  let fetched = 0;
  for (const [id, l] of found) {
    if (known.has(id) || fetched >= maxNew) continue;
    fetched++;
    const html = await getText(l.url, "ueb.edu.vn", "text/html");
    const item = html ? parseUebArticle(html, l.url, l.type) : null;
    if (item) items.push(item);
  }
  return { source: "ueb", ok, items };
}

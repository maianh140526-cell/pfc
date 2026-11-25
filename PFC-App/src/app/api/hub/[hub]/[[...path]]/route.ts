import { NextResponse } from "next/server";
import { currentMember, type Member } from "@/platform/auth/session";
import { HUB_CONFIG, filterSetCookie, isHubId, pickCookie, type HubConfig } from "@/platform/hub-proxy/config";
import { mintPlatformToken, ownerCookieName, ownerTag } from "@/platform/hub-proxy/sso";

export const dynamic = "force-dynamic";

const FORWARD_REQ_HEADERS = ["content-type", "accept", "idempotency-key"];
const FORWARD_RES_HEADERS = ["content-type", "content-disposition"];
const MAX_BODY = 6 * 1024 * 1024; // CV upload limit upstream is 5 MB
/**
 * A stopped hub fails fast (connection refused). This only bounds a hub that is up but slow,
 * e.g. a Next dev server compiling a route for the first time (often 15–40 s on Windows).
 */
const HUB_TIMEOUT_MS = 60_000;

type Ctx = { params: Promise<{ hub: string; path?: string[] }> };

const offline = (cfg: HubConfig) =>
  NextResponse.json({ error: `Chưa kết nối được máy chủ ${cfg.name}.`, code: "HUB_OFFLINE" }, { status: 503, headers: { "cache-control": "no-store" } });

/**
 * One account for every hub (ADR-011): exchange the PFC identity for the hub's own session.
 * Returns the hub cookie pair ("name=value") and the Set-Cookie to hand back to the browser.
 */
async function exchange(cfg: HubConfig, member: Member): Promise<{ cookie: string; setCookie: string } | null> {
  const secret = cfg.sso.secret();
  if (!secret) return null;
  // Role + department let hubs grant posting / review rights to PFC leaders (ADR-011 addendum).
  const token = mintPlatformToken(
    { sub: member.id, email: member.email, name: member.fullName, pfc_role: member.role, pfc_department: member.department ?? null },
    cfg.sso.audience,
    secret,
    Math.floor(Date.now() / 1000),
  );
  const res = await fetch(`${cfg.origin().replace(/\/$/, "")}${cfg.sso.path}`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ id_token: token }),
    redirect: "manual",
    cache: "no-store",
    signal: AbortSignal.timeout(HUB_TIMEOUT_MS),
  });
  if (!res.ok) return null;
  for (const sc of res.headers.getSetCookie()) {
    const safe = filterSetCookie(sc, cfg.cookie);
    if (safe) return { cookie: safe.split(";")[0], setCookie: safe };
  }
  return null;
}

async function proxy(req: Request, ctx: Ctx): Promise<Response> {
  const { hub, path = [] } = await ctx.params;
  if (!isHubId(hub)) return NextResponse.json({ error: "Not found" }, { status: 404 });
  const cfg = HUB_CONFIG[hub];
  const upstreamPath = cfg.upstreamPath(path);
  if (!upstreamPath) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const url = new URL(req.url);
  if (cfg.blocked?.(url.searchParams)) return NextResponse.json({ error: "Not found" }, { status: 404 });
  const target = `${cfg.origin().replace(/\/$/, "")}${upstreamPath}${url.search}`;

  let body: ArrayBuffer | undefined;
  if (req.method !== "GET" && req.method !== "HEAD") {
    body = await req.arrayBuffer();
    if (body.byteLength > MAX_BODY) return NextResponse.json({ error: "Tệp quá lớn" }, { status: 413 });
    if (cfg.blockedActions && (req.headers.get("content-type") ?? "").includes("application/json")) {
      try {
        const action = (JSON.parse(new TextDecoder().decode(body)) as { action?: unknown }).action;
        if (typeof action === "string" && cfg.blockedActions.includes(action)) {
          return NextResponse.json({ error: "Not found" }, { status: 404 });
        }
      } catch {
        /* not JSON: upstream will reject it */
      }
    }
  }

  const member = await currentMember();
  const secret = cfg.sso.secret();
  const ownerName = ownerCookieName(cfg.cookie);
  // The tag covers role + department, so a role change re-runs the SSO exchange (hub rights follow PFC roles).
  const expectedOwner = member && secret ? ownerTag(hub, `${member.id}:${member.role}:${member.department ?? ""}`, secret) : null;
  const presentedOwner = pickCookie(req.headers.get("cookie"), ownerName)?.split("=")[1] ?? null;
  // Use an existing hub session only if it was minted for this exact PFC member.
  let cookie = member && expectedOwner && presentedOwner === expectedOwner ? pickCookie(req.headers.get("cookie"), cfg.cookie) : null;
  const outCookies: string[] = [];

  async function ensureSession(): Promise<boolean> {
    if (!member) return false;
    const ex = await exchange(cfg, member).catch(() => null);
    if (!ex) return false;
    cookie = ex.cookie;
    outCookies.push(ex.setCookie);
    if (expectedOwner) {
      const secure = process.env.NODE_ENV === "production" && process.env.PFC_INSECURE_COOKIES !== "1" ? "; Secure" : "";
      outCookies.push(`${ownerName}=${expectedOwner}; Path=/; HttpOnly; SameSite=Lax; Max-Age=604800${secure}`);
    }
    return true;
  }

  async function send(): Promise<Response> {
    const headers = new Headers();
    for (const h of FORWARD_REQ_HEADERS) {
      const v = req.headers.get(h);
      if (v) headers.set(h, v);
    }
    if (cookie) headers.set("cookie", cookie);
    return fetch(target, { method: req.method, headers, body, redirect: "manual", cache: "no-store", signal: AbortSignal.timeout(HUB_TIMEOUT_MS) });
  }

  let upstream: Response;
  try {
    if (member && !cookie) await ensureSession();
    upstream = await send();
    // Hub session expired or belongs to nobody: re-exchange once and retry.
    if (upstream.status === 401 && member && (await ensureSession())) upstream = await send();
  } catch {
    return offline(cfg);
  }

  const out = new Headers({ "cache-control": "private, no-store" });
  for (const h of FORWARD_RES_HEADERS) {
    const v = upstream.headers.get(h);
    if (v) out.set(h, v);
  }
  // Signed out of PFC → drop any stale hub session so it can't outlive the platform session.
  if (!member && pickCookie(req.headers.get("cookie"), cfg.cookie)) {
    out.append("set-cookie", `${cfg.cookie}=; Path=/; Max-Age=0`);
    out.append("set-cookie", `${ownerName}=; Path=/; Max-Age=0`);
  }
  for (const sc of outCookies) out.append("set-cookie", sc);
  for (const sc of upstream.headers.getSetCookie()) {
    const safe = filterSetCookie(sc, cfg.cookie);
    if (safe) out.append("set-cookie", safe);
  }
  if (upstream.status >= 300 && upstream.status < 400) {
    return NextResponse.json({ error: "Unexpected redirect from hub" }, { status: 502, headers: out });
  }
  return new Response(upstream.body, { status: upstream.status, headers: out });
}

export { proxy as GET, proxy as POST, proxy as PUT, proxy as PATCH, proxy as DELETE };

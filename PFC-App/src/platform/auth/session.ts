import "server-only";
import { randomUUID } from "node:crypto";
import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";
import { all, one, run } from "@/platform/db/client";
import { ActionError as ActionErrorImpl } from "@/platform/errors";
import { isDepartment, isRole, type Actor, type Department, type Role } from "@/platform/roles";
import { notify } from "@/platform/notifications/service";
import { deviceLabel, ipHint } from "./device";
import { SESSION_COOKIE, SESSION_TTL_SECONDS, SHORT_SESSION_TTL_SECONDS, createSessionToken, verifySessionToken } from "./session-token";

export type Member = {
  id: string;
  email: string;
  fullName: string;
  createdAt: string;
  role: Role;
  department: Department | null;
  avatarUrl: string | null;
  onboarded: boolean;
};

/** Hub session cookies minted by the gateway for the signed-in PFC member (ADR-011). */
export const HUB_COOKIES = ["pfc_club_session", "pfc_opp_session", "pfc_club_session_owner", "pfc_opp_session_owner"] as const;

export function toActor(m: Member): Actor {
  return { id: m.id, role: m.role, department: m.department };
}

function secret(): string {
  const s = process.env.PFC_SESSION_SECRET ?? "";
  if (!s) throw new Error("PFC_SESSION_SECRET is not set (see .env.example)");
  return s;
}

const nowSec = () => Math.floor(Date.now() / 1000);
const nowIso = () => new Date().toISOString();
/** last_seen_at is refreshed at most this often (avoids a write on every request). */
const SEEN_EVERY_MS = 5 * 60_000;

async function requestDevice(): Promise<{ device: string; ip: string | null }> {
  const h = await headers();
  const ip = h.get("x-forwarded-for")?.split(",")[0]?.trim() || h.get("x-real-ip");
  return { device: deviceLabel(h.get("user-agent")), ip: ipHint(ip) };
}

/**
 * Signs the member in on this device. remember=true ("Ghi nhớ đăng nhập"): 30-day persistent cookie.
 * remember=false: browser-session cookie whose token also expires after 12 h.
 * Every sign-in is a row in member_sessions so it can be listed and revoked (mockup 269).
 */
export async function startSession(memberId: string, opts: { remember?: boolean } = {}): Promise<void> {
  const remember = opts.remember ?? true;
  const v = await one<{ session_version: number }>("SELECT session_version FROM members WHERE id = ?", [memberId]);
  const jar = await cookies();
  // Replacing a session on this browser closes the old row.
  const old = verifySessionToken(jar.get(SESSION_COOKIE)?.value, secret(), nowSec());
  if (old?.sid) await run("UPDATE member_sessions SET revoked_at = ? WHERE id = ? AND revoked_at IS NULL", [nowIso(), old.sid]);
  // A new PFC identity must never inherit hub sessions of the previous one.
  for (const c of HUB_COOKIES) jar.delete(c);
  const sid = randomUUID();
  const { device, ip } = await requestDevice();
  const seenBefore = await one("SELECT 1 AS x FROM member_sessions WHERE member_id = ? LIMIT 1", [memberId]);
  await run("INSERT INTO member_sessions (id, member_id, device, ip_hint, created_at, last_seen_at) VALUES (?, ?, ?, ?, ?, ?)", [sid, memberId, device, ip, nowIso(), nowIso()]);
  const ttl = remember ? SESSION_TTL_SECONDS : SHORT_SESSION_TTL_SECONDS;
  jar.set(SESSION_COOKIE, createSessionToken(memberId, secret(), nowSec(), ttl, Number(v?.session_version ?? 0), sid), {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production" && process.env.PFC_INSECURE_COOKIES !== "1",
    path: "/",
    ...(remember ? { maxAge: SESSION_TTL_SECONDS } : {}),
  });
  // Security notice on every new sign-in after the first (always in-app + email; see CATEGORIES.account).
  if (seenBefore) {
    await notify(memberId, { category: "account", title: `Đăng nhập mới: ${device}`, body: `${ip ? `IP ${ip} · ` : ""}${new Date().toLocaleString("vi-VN", { timeZone: "Asia/Ho_Chi_Minh" })}. Không phải bạn? Đăng xuất thiết bị đó và đổi mật khẩu.`, href: "/more/account/devices" });
  }
}

export async function endSession(): Promise<void> {
  const jar = await cookies();
  const p = verifySessionToken(jar.get(SESSION_COOKIE)?.value, secret(), nowSec());
  if (p?.sid) await run("UPDATE member_sessions SET revoked_at = ? WHERE id = ? AND revoked_at IS NULL", [nowIso(), p.sid]);
  jar.delete(SESSION_COOKIE);
  for (const c of HUB_COOKIES) jar.delete(c);
}

/** The session id of this browser (for "Thiết bị hiện tại"). */
export async function currentSessionId(): Promise<string | null> {
  const p = verifySessionToken((await cookies()).get(SESSION_COOKIE)?.value, secret(), nowSec());
  return p?.sid ?? null;
}

/**
 * Current member or null. Identity and role are always re-read from the DB, never trusted from the cookie.
 * The session row must exist and not be revoked (devices signed out from another device stop working).
 */
export async function currentMember(): Promise<Member | null> {
  const payload = verifySessionToken((await cookies()).get(SESSION_COOKIE)?.value, secret(), nowSec());
  if (!payload?.sid) return null;
  const s = await one<{ member_id: string; last_seen_at: string; revoked_at: string | null }>("SELECT member_id, last_seen_at, revoked_at FROM member_sessions WHERE id = ?", [payload.sid]);
  if (!s || s.revoked_at || s.member_id !== payload.sub) return null;
  const m = await memberById(payload.sub, payload.ver);
  if (m && Date.now() - Date.parse(s.last_seen_at) > SEEN_EVERY_MS) {
    await run("UPDATE member_sessions SET last_seen_at = ? WHERE id = ?", [nowIso(), payload.sid]);
  }
  return m;
}

/** Loads a member; locked or deleted accounts count as signed out everywhere. */
export async function memberById(id: string, sessionVersion?: number): Promise<Member | null> {
  const row = await one<{
    id: string;
    email: string;
    full_name: string;
    created_at: string;
    role: string;
    department: string | null;
    locked: number;
    session_version: number;
    avatar_url: string | null;
    onboarded_at: string | null;
    deleted_at: string | null;
  }>("SELECT id, email, full_name, created_at, role, department, locked, session_version, avatar_url, onboarded_at, deleted_at FROM members WHERE id = ?", [id]);
  if (!row || Number(row.locked) === 1 || row.deleted_at) return null;
  // Sessions issued before a password reset are revoked.
  if (sessionVersion !== undefined && Number(row.session_version) !== sessionVersion) return null;
  return {
    id: row.id,
    email: row.email,
    fullName: row.full_name,
    createdAt: row.created_at,
    role: isRole(row.role) ? row.role : "thanh_vien",
    department: isDepartment(row.department) ? row.department : null,
    avatarUrl: row.avatar_url,
    onboarded: !!row.onboarded_at,
  };
}

export type DeviceSession = { id: string; device: string; ipHint: string | null; createdAt: string; lastSeenAt: string; current: boolean };

/** MEM-06 / mockup 269: active sessions of the member, current device first. */
export async function listSessions(memberId: string): Promise<DeviceSession[]> {
  const current = await currentSessionId();
  const rows = await all<{ id: string; device: string; ip_hint: string | null; created_at: string; last_seen_at: string }>(
    "SELECT id, device, ip_hint, created_at, last_seen_at FROM member_sessions WHERE member_id = ? AND revoked_at IS NULL ORDER BY last_seen_at DESC LIMIT 50",
    [memberId],
  );
  return rows
    .map((r) => ({ id: r.id, device: r.device, ipHint: r.ip_hint, createdAt: r.created_at, lastSeenAt: r.last_seen_at, current: r.id === current }))
    .sort((a, b) => Number(b.current) - Number(a.current));
}

/** Signs one device out (only the member's own sessions). */
export async function revokeSession(memberId: string, sessionId: string): Promise<boolean> {
  return (await run("UPDATE member_sessions SET revoked_at = ? WHERE id = ? AND member_id = ? AND revoked_at IS NULL", [nowIso(), sessionId, memberId])) === 1;
}

/** "Đăng xuất tất cả thiết bị khác": keeps only this browser (or none when keep is null). */
export async function revokeOtherSessions(memberId: string, keep: string | null): Promise<number> {
  return run("UPDATE member_sessions SET revoked_at = ? WHERE member_id = ? AND revoked_at IS NULL AND id != ?", [nowIso(), memberId, keep ?? ""]);
}

/** For pages: redirect to login (and come back afterwards) when not signed in. */
export async function requireMember(returnTo: string): Promise<Member> {
  const m = await currentMember();
  if (!m) redirect(`/login?next=${encodeURIComponent(returnTo)}`);
  return m;
}

/** For server actions: throw instead of redirecting mid-mutation. */
export async function requireMemberForAction(): Promise<Member> {
  const m = await currentMember();
  if (!m) throw new ActionErrorImpl("Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại.");
  return m;
}

export { ActionError } from "@/platform/errors";

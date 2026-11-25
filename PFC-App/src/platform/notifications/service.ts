import "server-only";
import { randomUUID } from "node:crypto";
import { after } from "next/server";
import { all, one, run } from "@/platform/db/client";
import { publicUrl, sendMail } from "@/platform/mail";
import { CATEGORIES, CHANNELS, effectivePref, isCategory, type Category, type Channel } from "./categories";
import { sendPush } from "./push";

/**
 * Notification Center (NOT-01…05). One call from a module ("notify") stores the in-app item and,
 * after the response is sent, delivers email / Web Push according to the member's preferences.
 * Titles and links never contain secrets; hrefs are same-site paths only.
 */
export type NotifyInput = { category: Category; title: string; body?: string; href?: string; dedupeKey?: string };
export type Notification = { id: string; category: Category; title: string; body: string; href: string | null; createdAt: string; readAt: string | null };

const now = () => new Date().toISOString();
const safeHref = (h?: string) => (h && h.startsWith("/") && !h.startsWith("//") ? h : null);

async function storedPrefs(memberId: string): Promise<Record<string, boolean>> {
  const rows = await all<{ category: string; channel: string; enabled: number }>("SELECT category, channel, enabled FROM notification_prefs WHERE member_id = ?", [memberId]);
  return Object.fromEntries(rows.map((r) => [`${r.category}:${r.channel}`, !!r.enabled]));
}

/** Runs work after the response (Next `after`); outside a request (tests, scripts) it just runs. */
function later(job: () => Promise<unknown>): void {
  const safe = () => job().catch((err) => console.error("[notify]", err));
  try {
    after(safe);
  } catch {
    void safe();
  }
}

/** Notifies one or more members. Never throws to the caller: a failed notification must not undo the action. */
export async function notify(memberIds: string | string[], n: NotifyInput): Promise<void> {
  const ids = [...new Set(Array.isArray(memberIds) ? memberIds : [memberIds])].filter(Boolean);
  for (const memberId of ids) {
    try {
      const prefs = await storedPrefs(memberId);
      const href = safeHref(n.href);
      if (effectivePref(n.category, "inapp", prefs)) {
        await run(
          `INSERT INTO notifications (id, member_id, category, title, body, href, dedupe_key, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
           ON CONFLICT (member_id, dedupe_key) DO NOTHING`,
          [randomUUID(), memberId, n.category, n.title.slice(0, 160), (n.body ?? "").slice(0, 500), href, n.dedupeKey ?? null, now()],
        );
      }
      const wantEmail = effectivePref(n.category, "email", prefs);
      const wantPush = effectivePref(n.category, "push", prefs);
      if (wantEmail || wantPush) {
        later(async () => {
          const m = await one<{ email: string; deleted_at: string | null; locked: number }>("SELECT email, deleted_at, locked FROM members WHERE id = ?", [memberId]);
          if (!m || m.deleted_at || Number(m.locked) === 1) return;
          if (wantEmail) {
            await sendMail({
              to: m.email,
              subject: `PFC · ${n.title}`,
              text: `${n.body ?? ""}\n\n${href ? `${publicUrl()}${href}\n\n` : ""}Đổi cài đặt thông báo: ${publicUrl()}/more/notifications`,
            });
          }
          if (wantPush) await sendPush(memberId, { title: n.title, body: n.body ?? "", href: href ?? "/notifications" });
        });
      }
    } catch (err) {
      console.error("[notify]", err);
    }
  }
}

export async function listNotifications(memberId: string, opts: { unread?: boolean; category?: string; limit?: number } = {}): Promise<Notification[]> {
  const where = ["member_id = ?"];
  const args: (string | number)[] = [memberId];
  if (opts.unread) where.push("read_at IS NULL");
  if (opts.category && isCategory(opts.category)) (where.push("category = ?"), args.push(opts.category));
  const rows = await all<{ id: string; category: string; title: string; body: string; href: string | null; created_at: string; read_at: string | null }>(
    `SELECT * FROM notifications WHERE ${where.join(" AND ")} ORDER BY created_at DESC LIMIT ?`,
    [...args, Math.min(opts.limit ?? 50, 200)],
  );
  return rows.map((r) => ({ id: r.id, category: isCategory(r.category) ? r.category : "account", title: r.title, body: r.body, href: r.href, createdAt: r.created_at, readAt: r.read_at }));
}

export async function unreadCount(memberId: string): Promise<number> {
  return Number((await one<{ n: number }>("SELECT COUNT(*) AS n FROM notifications WHERE member_id = ? AND read_at IS NULL", [memberId]))?.n ?? 0);
}

export async function markRead(memberId: string, id: string): Promise<void> {
  await run("UPDATE notifications SET read_at = COALESCE(read_at, ?) WHERE id = ? AND member_id = ?", [now(), id, memberId]);
}

export async function markAllRead(memberId: string): Promise<number> {
  return run("UPDATE notifications SET read_at = ? WHERE member_id = ? AND read_at IS NULL", [now(), memberId]);
}

/** Keeps the inbox bounded: read items older than 90 days are removed. */
export async function pruneOld(memberId: string): Promise<void> {
  await run("DELETE FROM notifications WHERE member_id = ? AND read_at IS NOT NULL AND created_at < ?", [memberId, new Date(Date.now() - 90 * 86_400_000).toISOString()]);
}

export type Prefs = Record<Category, Record<Channel, boolean>>;

export async function getPrefs(memberId: string): Promise<Prefs> {
  const stored = await storedPrefs(memberId);
  return Object.fromEntries(
    (Object.keys(CATEGORIES) as Category[]).map((c) => [c, Object.fromEntries(CHANNELS.map((ch) => [ch, effectivePref(c, ch, stored)]))]),
  ) as Prefs;
}

export async function setPref(memberId: string, category: unknown, channel: unknown, enabled: boolean): Promise<void> {
  if (!isCategory(category) || !(CHANNELS as readonly string[]).includes(String(channel))) throw new Error("invalid preference");
  if (CATEGORIES[category].locked && channel !== "push") return; // security notices stay on
  await run(
    `INSERT INTO notification_prefs (member_id, category, channel, enabled) VALUES (?, ?, ?, ?)
     ON CONFLICT (member_id, category, channel) DO UPDATE SET enabled = excluded.enabled`,
    [memberId, category, String(channel), enabled ? 1 : 0],
  );
}

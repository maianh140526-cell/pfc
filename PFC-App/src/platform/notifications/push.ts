import "server-only";
import webpush from "web-push";
import { all, run } from "@/platform/db/client";

/**
 * Web Push (NOT-05, P5). VAPID keys from env; without them push is simply off.
 * iPhone: only works for the app installed to the home screen (iOS 16.4+).
 * Payload is a short title/body/href — never personal data beyond what the notification says.
 */
export function pushConfigured(): boolean {
  return !!(process.env.PFC_VAPID_PUBLIC_KEY && process.env.PFC_VAPID_PRIVATE_KEY && process.env.PFC_VAPID_SUBJECT);
}
export const vapidPublicKey = () => process.env.PFC_VAPID_PUBLIC_KEY ?? "";

let configured = false;
function setup(): boolean {
  if (!pushConfigured()) return false;
  if (!configured) {
    webpush.setVapidDetails(process.env.PFC_VAPID_SUBJECT!, process.env.PFC_VAPID_PUBLIC_KEY!, process.env.PFC_VAPID_PRIVATE_KEY!);
    configured = true;
  }
  return true;
}

export type PushPayload = { title: string; body: string; href: string };

export async function sendPush(memberId: string, payload: PushPayload): Promise<number> {
  if (!setup()) return 0;
  const subs = await all<{ endpoint: string; p256dh: string; auth: string }>("SELECT endpoint, p256dh, auth FROM push_subscriptions WHERE member_id = ?", [memberId]);
  let ok = 0;
  for (const s of subs) {
    try {
      await webpush.sendNotification({ endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } }, JSON.stringify(payload), { TTL: 24 * 3600, urgency: "normal" });
      await run("UPDATE push_subscriptions SET last_ok_at = ? WHERE endpoint = ?", [new Date().toISOString(), s.endpoint]);
      ok += 1;
    } catch (err) {
      const status = (err as { statusCode?: number }).statusCode;
      // 404/410: the browser dropped this subscription — forget it.
      if (status === 404 || status === 410) await run("DELETE FROM push_subscriptions WHERE endpoint = ?", [s.endpoint]);
      else console.error("[push]", status ?? err);
    }
  }
  return ok;
}

/**
 * Push endpoints come from the browser, and the server POSTs to them — so only the real browser push
 * services are accepted (Chrome/Edge/Samsung → FCM, Firefox → Mozilla, Safari → Apple, Windows → WNS).
 * An allow-list, not a block-list, so the server can never be pointed at an internal address.
 */
const PUSH_HOSTS = [/^fcm\.googleapis\.com$/, /^android\.googleapis\.com$/, /^updates\.push\.services\.mozilla\.com$/, /^([a-z0-9-]+\.)*push\.apple\.com$/, /^([a-z0-9-]+\.)*notify\.windows\.com$/];

export function validEndpoint(u: unknown): u is string {
  if (typeof u !== "string" || u.length > 1000) return false;
  try {
    const url = new URL(u);
    return url.protocol === "https:" && !url.port && PUSH_HOSTS.some((re) => re.test(url.hostname));
  } catch {
    return false;
  }
}

export async function saveSubscription(memberId: string, sub: { endpoint: unknown; keys?: { p256dh?: unknown; auth?: unknown } }, device: string): Promise<void> {
  const { endpoint, keys } = sub;
  if (!validEndpoint(endpoint) || typeof keys?.p256dh !== "string" || typeof keys?.auth !== "string" || keys.p256dh.length > 200 || keys.auth.length > 100) {
    throw new Error("invalid subscription");
  }
  await run(
    `INSERT INTO push_subscriptions (endpoint, member_id, p256dh, auth, device, created_at) VALUES (?, ?, ?, ?, ?, ?)
     ON CONFLICT (endpoint) DO UPDATE SET member_id = excluded.member_id, p256dh = excluded.p256dh, auth = excluded.auth, device = excluded.device`,
    [endpoint, memberId, keys.p256dh, keys.auth, device, new Date().toISOString()],
  );
}

export async function removeSubscription(memberId: string, endpoint: string): Promise<void> {
  await run("DELETE FROM push_subscriptions WHERE endpoint = ? AND member_id = ?", [endpoint, memberId]);
}

export async function subscriptionCount(memberId: string): Promise<number> {
  return Number((await all<{ n: number }>("SELECT COUNT(*) AS n FROM push_subscriptions WHERE member_id = ?", [memberId]))[0]?.n ?? 0);
}

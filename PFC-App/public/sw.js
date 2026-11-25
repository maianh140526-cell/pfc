/*
 * PFC service worker (ADR-009). Hand-written so every caching rule is auditable.
 *
 * Privacy rule (BR-009, NFR-S-003, Luật BVDLCN 91/2025): never put member data in Cache
 * Storage. Only build assets, icons and the offline page are cached. HTML navigations and
 * /api/* always go to the network; when offline, navigations fall back to /offline.html
 * (plain HTML, no Next.js runtime — a Next page served under another URL would crash).
 *
 * Bump VERSION whenever this file's caching rules or the precache list change.
 */
const VERSION = "v4";
const SHELL_CACHE = `pfc-shell-${VERSION}`;
const ASSET_CACHE = `pfc-assets-${VERSION}`;
const OFFLINE_URL = "/offline.html";

const PRECACHE = [
  OFFLINE_URL,
  "/manifest.webmanifest",
  "/icons/icon-192.png",
  "/icons/icon-512.png",
  "/brand/pfc-mark.png",
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(SHELL_CACHE).then((cache) => cache.addAll(PRECACHE)),
  );
  // Do not skipWaiting automatically: the page asks first, so an update never swaps
  // code under a user in the middle of a form.
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    (async () => {
      const keep = new Set([SHELL_CACHE, ASSET_CACHE]);
      const names = await caches.keys();
      await Promise.all(names.filter((n) => n.startsWith("pfc-") && !keep.has(n)).map((n) => caches.delete(n)));
      if (self.registration.navigationPreload) await self.registration.navigationPreload.enable();
      await self.clients.claim();
    })(),
  );
});

self.addEventListener("message", (event) => {
  const type = event.data && event.data.type;
  if (type === "SKIP_WAITING") self.skipWaiting();
  // Called on logout. Nothing personal is cached today; this keeps the contract for later.
  if (type === "CLEAR_CACHES") {
    event.waitUntil(caches.keys().then((names) => Promise.all(names.map((n) => caches.delete(n)))));
  }
});

/*
 * Web Push (NOT-05). The payload is only { title, body, href } from our server.
 * Clicking focuses an open PFC tab or opens one — only same-site paths are followed.
 */
self.addEventListener("push", (event) => {
  let data = { title: "PFC", body: "", href: "/notifications" };
  try {
    if (event.data) data = { ...data, ...event.data.json() };
  } catch {
    /* non-JSON payload: show the default */
  }
  const href = typeof data.href === "string" && data.href.startsWith("/") && !data.href.startsWith("//") ? data.href : "/notifications";
  event.waitUntil(
    self.registration.showNotification(String(data.title).slice(0, 120), {
      body: String(data.body ?? "").slice(0, 300),
      icon: "/icons/icon-192.png",
      badge: "/icons/icon-192.png",
      data: { href },
      lang: "vi",
    }),
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const href = (event.notification.data && event.notification.data.href) || "/notifications";
  const target = new URL(href, self.location.origin).href;
  event.waitUntil(
    (async () => {
      const wins = await self.clients.matchAll({ type: "window", includeUncontrolled: true });
      for (const w of wins) {
        if (new URL(w.url).origin === self.location.origin && "focus" in w) {
          await w.focus();
          if ("navigate" in w) return w.navigate(target);
          return;
        }
      }
      return self.clients.openWindow(target);
    })(),
  );
});

function isHashedAsset(url) {
  return url.pathname.startsWith("/_next/static/");
}

function isPublicStatic(url) {
  return (
    url.pathname.startsWith("/icons/") ||
    url.pathname.startsWith("/brand/") ||
    url.pathname === "/manifest.webmanifest"
  );
}

self.addEventListener("fetch", (event) => {
  const { request } = event;
  if (request.method !== "GET") return;
  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;
  if (url.pathname.startsWith("/api/")) return; // network only, never cached

  if (request.mode === "navigate") {
    event.respondWith(
      (async () => {
        try {
          const preload = await event.preloadResponse;
          if (preload) return preload;
          return await fetch(request);
        } catch {
          const cache = await caches.open(SHELL_CACHE);
          return (await cache.match(OFFLINE_URL)) || Response.error();
        }
      })(),
    );
    return;
  }

  // Content-hashed build output never changes: cache-first.
  if (isHashedAsset(url)) {
    event.respondWith(
      (async () => {
        const cache = await caches.open(ASSET_CACHE);
        const hit = await cache.match(request);
        if (hit) return hit;
        const res = await fetch(request);
        if (res.ok) cache.put(request, res.clone());
        return res;
      })(),
    );
    return;
  }

  // Icons / logo / manifest: serve cached, refresh in background.
  if (isPublicStatic(url)) {
    event.respondWith(
      (async () => {
        const cache = await caches.open(SHELL_CACHE);
        const hit = await cache.match(request);
        const refresh = fetch(request)
          .then((res) => {
            if (res.ok) cache.put(request, res.clone());
            return res;
          })
          .catch(() => hit);
        return hit || refresh;
      })(),
    );
  }
});

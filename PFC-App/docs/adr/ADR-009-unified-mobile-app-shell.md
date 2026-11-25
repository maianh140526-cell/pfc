# ADR-009: Unified mobile App Shell (PWA) for PFC Digital Hub

## Status
Accepted — 19/11/2026 (P1 implemented in `PFC-App/`). DEC-M4 (colours/font) and DEC-M5 (tabs) are **provisional** until the brand kit is signed off.

## Context
- SRS A01: responsive web app is the main presentation layer. All 275 mockup screens in `source/` are phone screens.
- SRS Q14: push notifications are required at launch. On iPhone, Web Push only works for a site **installed to the Home Screen** (iOS ≥ 16.4) → the web app must be an installable PWA.
- Before this ADR there were three separate apps: Club (Next.js), Opportunity Hub (Next.js), Personal Finance (Flutter Web), each with its own sign-in, colours and navigation. This conflicts with FR-X-001 (one Member ID) and gives no app-like experience.
- Research: [`../../../MOBILE_WEB_APP.md`](../../../MOBILE_WEB_APP.md).

## Decision
1. **One App Shell** — `PFC-App/`, Next.js 15 App Router, one deployable (modular monolith, consistent with Opportunity ADR-001). Every hub becomes a bounded module inside it; the shell owns navigation, theme, PWA and (from P2) identity.
2. **Personal Finance moves to the web stack** (P3). The Flutter app becomes the specification for the port; it may later be kept only as a native Android client.
3. **PWA**
   - `app/manifest.ts`: `display: standalone`, `start_url: /home`, icons 192/512 + maskable, shortcuts.
   - Hand-written `public/sw.js` (no plugin) so every caching rule can be reviewed.
   - Cached: `/_next/static/*` (cache-first, hashed), icons/logo/manifest (stale-while-revalidate), `/offline.html`.
   - **Never cached by the SW:** page HTML and `/api/*` (privacy: BR-009, NFR-S-003, Luật BVDLCN 91/2025).
   - Offline navigations fall back to `public/offline.html`, plain HTML with no Next.js runtime. A Next page served under a different URL tries to fetch that route's data and crashes; this was reproduced and fixed during P1.
   - Updates do not use automatic `skipWaiting`. The page shows "Đã có phiên bản mới — chạm để cập nhật", so a new version never swaps code in the middle of a form.
   - `CLEAR_CACHES` message is reserved for logout (P2).
4. **Layout**: document scroll (not an inner scroller) so iOS collapses the address bar and tap-to-top works; fixed tab bar + sticky header; `viewport-fit=cover` + `env(safe-area-inset-*)`; zoom **not** disabled (inputs use 16px instead). Desktop shows a centred 430px canvas.
5. **Design tokens** in `src/app/globals.css` (CSS variables → Tailwind 4 `@theme inline`). Primary `#6A5FDD` sampled from mockup buttons; logo lavender `#8479C7`. Light / Dark / Auto (mockup 101). Contrast ≥ 4.5:1 for text pairs is enforced by `src/ui/contrast.test.ts`.
6. **Navigation**: 5 fixed tabs — Trang chủ · Tài chính · Học tập · Cộng đồng · Thêm (mockup 8/12). Other hubs are reached from Home → Khám phá. Every child screen has a back button, because iOS standalone mode has no browser back.
7. **Shared UI kit** in `src/ui/` (AppHeader, TabBar, BottomSheet, Fab, ListGroup/ListItem, SegmentedTabs, AmountInput, Card/Section, EmptyState, Skeleton, Badge, Button). Modules must use these, not their own copies. Live gallery: `/more/ui-kit`.

## Consequences
- Pages that will show personal data (P2+) must send `Cache-Control: private, no-store`. Static public pages may be served from the browser HTTP cache when offline; this was observed in testing and is acceptable for public content only.
- Club and Opportunity keep their `domain/` + `server/` + tests when moved in (P4); only UI and the auth adapter change.
- iOS cannot show a native install prompt; the shell shows "Chia sẻ → Thêm vào MH chính" steps instead (`InstallCard`).
- iOS splash images (`apple-touch-startup-image`) are not generated yet; iOS shows the background colour on launch.

## Rollout
P1 shell + PWA (this ADR) → P2 identity → P3 Finance → P4 move Club and Opportunity in → P5 push and Home → P6+ the other hubs.

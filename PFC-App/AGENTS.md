# AGENTS.md — PFC App Shell (mobile web app / PWA)

The single presentation layer for PFC Digital Hub: open it in a phone browser and it looks and works like an app. Decisions: [ADR-009](./docs/adr/ADR-009-unified-mobile-app-shell.md) (shell/PWA), [ADR-010](./docs/adr/ADR-010-hub-interiors-and-data.md) (hub interiors, Finance DB, hub gateway), [ADR-011](./docs/adr/ADR-011-one-account-roles-and-native-hubs.md) (one account + SSO, platform roles, Education / Marketplace / Project). Research and roadmap: [`../MOBILE_WEB_APP.md`](../MOBILE_WEB_APP.md).

## Non-negotiables
1. **UI follows the mockups in `../DATA/` (= `../source/`).** Map each screen to its Screen ID (SYS-*, FIN-*, OPP-*, COM-*…). Don't design screens that drift from the inventory.
2. **Use `src/ui/` components and tokens.** No hard-coded colours (use `bg-primary`, `text-muted`, …). If a component is missing, add it to `src/ui/` and to `/more/ui-kit`.
3. **Mobile rules:** hub roots use `<AppHeader backHref="/home">`; child screens use `<AppHeader back …>`; bottom sheet instead of modal; touch targets ≥ 44px; amounts use `AmountInput`; never disable zoom; never leave a `transform` on an ancestor of a `position: fixed` element.
4. **Service worker privacy:** never cache HTML pages, `/api/*` or member data. Bump `VERSION` in `public/sw.js` when it or `public/offline.html` changes.
5. **Bounded modules:** `src/modules/<hub>/{domain,server,ui}`. Domain is pure (no Next or DB imports). Don't import another module's internals.
6. **Finance data is owner-only (BR-009):** every query and action takes the member from `requireMember*()` and filters by `member_id`. Never accept a member id from the client. Validate with zod. Money is INTEGER VND.
7. **Opportunity / Club:** call them only through `hubFetch()` → `/api/hub/{opp|club}`. Don't re-implement their rules here; their services enforce authorization and FSMs.
8. **No made-up business rules or data.** Unbuilt features show an `EmptyState` naming the phase.
9. **Accessibility:** `npm test` includes WCAG contrast checks on the tokens. Chart colours follow the dataviz palette (validated) with visible legends.

10. **Permissions live in services.** Check `can(actor, …)` / in-project caps in `server/service.ts` and test each role boundary; UI only hides what the server already refuses. Members never delete or kick others.

## Layout
| Path | Purpose |
|---|---|
| `src/app/(app)/` | PFC-level screens with the global tab bar: `home`, `community`, `more` (+ appearance, password, ui-kit), `hub/[slug]` (coming soon) |
| `src/app/(auth)/` | `login`, `register` |
| `src/app/finance/` | Personal Finance interior: dashboard, transactions, overview, budgets, goals, challenges, categories, reports, tools, data (CSV) |
| `src/app/opportunities/` | Opportunity interior: discover, detail, apply, saved, applications, notifications, account, provider, review |
| `src/app/club/` | Club interior: overview, tasks (Kanban/Timeline), members, activities/events, notifications, approval queue, teams, report, documents |
| `src/app/learn/` | Education interior: courses, lessons, certificates, quizzes, resources, forum, my learning, manage |
| `src/app/market/` | Marketplace interior: discover, product, shop, cart, checkout, orders, seller channel, favorites, moderation |
| `src/app/projects/` | Project interior: discover, detail, workspace (tasks, updates, team, docs, analytics), mine, mentors, approval |
| `src/app/(app)/community`, `messages`, `members/[id]` | Community (G3): feed, posts, groups, member directory, moderation, 1-to-1 messages |
| `src/app/(app)/events` | Events (G4): discover, detail, register, tickets + QR, create/edit, manage, check-in, review |
| `src/app/(app)/payments` + `api/payments/vnpay/*` | Payments (G5): VNPAY return/IPN, history, result, refunds, payouts, staff overview |
| `src/app/finance/invest`, `insights`, `places` | Finance G6: investments, insights, Ngon – Bổ – Rẻ |
| `src/app/(app)/rewards` + `src/modules/rewards` | Points, tiers, rewards, referrals (G7); `/r/[code]` referral link |
| `src/app/(app)/admin` + `src/platform/admin/console.ts` | Admin console (G8): dashboard, member detail/restrictions, audit, settings/flags, rewards, broadcast, support |
| `src/platform/settings` | Feature flags, point rules, tiers (`app_settings`) |
| `src/app/opportunities/sources` + `src/modules/oppfeed` | Opportunity feed: UEB announcements, Remote OK and We Work Remotely (public feeds, refreshed at most every 6 h and by the daily job), and posts by leaders (`opp.post`). Shows image, organisation, deadline and live status; always links back to the source. Upwork is link-only (its terms and bot protection forbid copying). |
| `src/platform/uploads` (`attachment`) | Study / listing files: photos (re-encoded) and PDF, Word, Excel, PowerPoint, TXT/CSV checked by their bytes, no macros, 4 MB. Used by Education documents and quizzes (`edu_attachments`) and digital listings. |
| `src/app/api/jobs/tick` | Daily job (CRON_SECRET): payment/order expiry, event reminders |
| `src/app/api/hub/[hub]/[[...path]]` | Hub gateway (allow-list, cookie isolation) |
| `src/modules/finance`, `education`, `market`, `projects`, `community`, `events`, `payments`, `rewards`, `support` | Native hubs: pure `domain/` + actor-based `server/service.ts` (every permission checked there) + `server/actions.ts` + `ui/` |
| `src/modules/opportunity`, `src/modules/club` | API types, session providers, hub UI pieces |
| `src/platform/` | `db` (libSQL + migrations), `auth` (PFC account, hub cookies), `roles` (permission matrix), `workflow` (content approval), `admin`, `audit`, `rate-limit`, `hub-proxy`, `pwa`, `theme` |
| `src/ui/` | Shared mobile components, charts |

## Run locally
```bash
cp .env.example .env.local   # set PFC_SESSION_SECRET (random 32+ bytes)
npm install
npm run build && npm start   # http://localhost:3200
npm test
npm run typecheck
```
**Everything at once:** `npm run start:all` (in `PFC-App`) starts Club :3000, Opportunity :3001 and PFC App :3200, warms up the hubs, and Ctrl+C stops all three. Without it, the Club / Cơ hội tabs show "Chưa kết nối được…".

Opportunity and Club screens need their services running (manual alternative):
- Club: `cd ../PFC-Management/apps/club && npm run dev:club` (:3000, demo `leader@pfc.vn` / `member@pfc.vn`, see CLUB.md)
- Opportunity: `cd "../PFC-Opportunity Hub/web" && npm run dev` (:3001, demo accounts in its README; re-run `npm run db:seed` if every opportunity has expired)

## Testing on a real phone
The service worker and install only work over **HTTPS** or on `localhost`. Deploy a preview, or use an HTTPS tunnel.

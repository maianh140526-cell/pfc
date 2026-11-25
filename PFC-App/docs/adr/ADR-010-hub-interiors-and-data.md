# ADR-010: Hub interiors, Finance data store, and the hub gateway

## Status
Accepted — 19/11/2026. Builds on ADR-009 (single App Shell).

## Context
The member wants each of the six branches on Home to open its **own interior** (own navigation), and Personal Finance, Opportunity Hub and Club Management to be complete inside the mobile web app, following the mockups in `DATA/` (same images as `source/`).

Starting point:
- Personal Finance existed only as a Flutter + Firebase app.
- Opportunity Hub (Next.js + Prisma) and Club (Next.js + Drizzle) are working services with their own business rules, RBAC, FSMs and tests.
- Platform single sign-on (P2) is not built yet.

## Decision
1. **Hub interiors.** `/finance`, `/opportunities`, `/club` each have their own layout and their own 5-item bottom tab bar (`ui/HubTabBar`). The hub root header has ‹ back to PFC Home. The global tab bar is only on the PFC-level screens (`(app)` group).
2. **Personal Finance is native to PFC-App** (`src/modules/finance`): `domain/` (pure, unit tested: dates in Vietnam time, analytics, challenges, calculators, CSV), `server/` (queries + server actions, every query scoped by `member_id`), `ui/`.
   - Store: the central libSQL database (`PFC_DB_URL`). Local file in dev, Turso in production, the same choice as Club ADR-007. **Not Firebase**: the SRS requires a centralised DB, and the platform needs one member identity.
   - Money: INTEGER VND. Dates: `"YYYY-MM-DDTHH:mm"` Vietnam local time.
   - Calculators and the default categories are ported from PFC Quỹ. One upstream bug was fixed: a "saving" challenge was failed on day 1 whenever savings were still below target.
3. **PFC account (start of P2).** `members` table, bcrypt passwords, HMAC-signed `pfc_session` cookie (same scheme as Club CM-104), login and register screens, change password, audit log, and an in-memory rate limit on auth.
4. **Opportunity and Club keep their own services** and are reached through a **same-origin gateway**, `/api/hub/{opp|club}/…` (`src/app/api/hub`). The gateway, not a plain rewrite, is required because it enforces:
   - **Paths:** only allow-listed paths are reachable. Opportunity `jobs/*` is blocked, and Club `bootstrap`, `run_jobs` and `metrics` are blocked.
   - **Cookies:** each hub receives only its own session cookie (`pfc_opp_session` / `pfc_club_session`), never `pfc_session`, and may only set its own cookie.
   - **Offline backend:** returns `503 HUB_OFFLINE`, shown as "Chưa kết nối được …" with how to start the service.
   - **Redirects:** upstream redirects are not followed.
   Business rules, authorization and state machines stay in those services. The UI only offers transitions their FSMs allow; the services enforce them.
5. **Interim per-hub sign-in.** Until P2 single sign-on, the Opportunity and Club interiors show a one-time sign-in to their own accounts, with a message explaining why.

## Consequences
- Local development runs three processes: PFC-App :3200, Club :3000, Opportunity :3001 (`.claude/launch.json` has all three).
- Opportunity demo data is seeded relative to the seed date; re-run its `npm run db:seed` when opportunities have expired.
- **Next:** P2 single sign-on. PFC-App becomes the identity provider, Club already consumes HS256 SSO (ADR-008), and Opportunity needs a matching consumer. Then remove the interim logins.
- Not built yet (they need storage, maps or moderation decisions): Ngon – Bổ – Rẻ places (FIN-26…34), receipt photos, the Shared Event Engine (tickets and check-in), and Club document upload.

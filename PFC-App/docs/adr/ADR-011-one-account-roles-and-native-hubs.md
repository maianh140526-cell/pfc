# ADR-011: One PFC account, platform roles, and the native Education / Marketplace / Project hubs

## Status
Accepted — 20/11/2026. Builds on ADR-009 (App Shell) and ADR-010 (hub interiors, gateway).

## Context
The member asked for these things:
- One login should work in **all six branches**.
- Functions must still be permission-checked:
  - The Chủ nhiệm can do everything.
  - A Thành viên cannot delete or kick anyone.
  - Each Trưởng ban has a clear list of what they can and cannot do.
- Education, Marketplace and Dự án (Project) must be finished, following `DATA/` (Screen Inventory: EDU-*, MKT-*, SELL-*, PRO-*; SRS FR-EDU, FR-MKT, FR-PROJ, §9 lifecycles).

## Decision

### 1. One account (single sign-on through the gateway)
- **PFC-App is the identity provider.** The `members` table holds the account.
- **Token exchange.** For each Club or Opportunity request, the gateway `/api/hub/{club|opp}/…` mints a 60 s HS256 platform token:
  - `iss` is `pfc-platform`.
  - `aud` is `pfc-club` or `pfc-opportunity`.
  - It is signed with a per-hub shared secret (`CLUB_SSO_SECRET`, `OPP_SSO_SECRET`).
  - The gateway exchanges it server-side: Club `POST /api/club/sso/session`, Opportunity `POST /api/auth/sso`.
- **Session binding.** The hub session cookie is bound to the PFC member with an HMAC `<cookie>_owner` tag, so a stale cookie can never act as someone else. On a 401 the gateway re-exchanges and retries once.
- **Sign-in and sign-out.** Logging in to or out of PFC clears every hub cookie. Password login to the hubs is blocked at the gateway.
- **Club stays a private club.** A new account still sees the join screen and needs approval. SSO does not create a membership.

### 2. Platform roles (`src/platform/roles.ts`)
- **Roles:** `chu_nhiem`, `ban_dieu_hanh`, `truong_ban` (+ department `chuyen_mon` | `truyen_thong` | `su_kien`), `thanh_vien`.
- **Permissions** are named (`edu.*`, `mkt.*`, `project.*`, `admin.*`) and checked in every service, never only in the UI.
- **Who gets what:**

  | Role | Permissions |
  |---|---|
  | Chủ nhiệm | All |
  | Ban điều hành | Moderation set, without role management, account locking or `project.manage_any` |
  | Trưởng ban Chuyên môn | Education content, forum moderation, project approval |
  | Trưởng ban Truyền thông | Forum moderation, Marketplace listing approval |
  | Trưởng ban Sự kiện | Forum moderation |
  | Thành viên | None, but manages their own content |

- **Account administration:**
  - Only a Chủ nhiệm changes roles, and the last Chủ nhiệm can never be removed.
  - A locked account has no permissions and is treated as signed out.
  - Emails in `PFC_OWNER_EMAILS` become Chủ nhiệm when they register.
- **Club** permissions stay in the Club service (`POSITION_PERMISSIONS`). A member gets 403 on kick and on approve, which was verified live.
- The **"Phân quyền"** screen (`/more/roles`) shows three matrices: platform, Club, and in-project.

### 3. Shared content workflow (`src/platform/workflow.ts`)
- **States:** draft → submitted → published → archived, plus rejected. A rejection always needs a reason.
- **Self-approval:** an author who is also an approver publishes directly.
- **Used by:** courses, quizzes, resources and Marketplace listings.

### 4. Native hubs (in PFC-App, central libSQL DB, migrations v3–v5)
Each hub follows the same layout: `src/modules/<hub>/{domain (pure, tested), server/service.ts (actor-based, tested on a temp DB), server/actions.ts}`, plus its own 5-tab interior.

- **Education** (`/learn`):
  - Courses, lessons (YouTube/Vimeo embeds, https only), enrolment, progress and certificates.
  - Quizzes: answers are never sent to the client, and an attempt is visible to its owner only.
  - Resources.
  - A forum with like, lock and hide.
  - A manage area for content creators and approvers.
- **Marketplace** (`/market`):
  - **Sellers:** a seller registers and is approved by `mkt.seller.approve` (risk-based, Q04). Listings are approved by `mkt.listing.approve`, and editing a published listing sends it back for review.
  - **Cart and checkout:**
    - Checkout splits the cart by seller.
    - Stock is decremented in an interactive transaction.
    - The checkout key makes it idempotent.
    - Prices come from the server.
  - **Order lifecycle:** placed → confirmed → shipping → delivered → completed, or cancelled.
    - A bank transfer must be marked paid before shipping.
    - The buyer can cancel only while the order is placed. The seller can cancel with a reason until shipping.
    - Cancelling restores stock.
    - Reviews are allowed only on completed orders.
  - **Payments:** PFC does not hold money. VNPAY is a later phase, as the SRS sets out.
- **Dự án / Project** (`/projects`):
  - **Lifecycle (SRS §9):** draft → submitted → active → completed → archived, plus rejected (reason required). Approval needs `project.approve`.
  - **In-project roles:**
    - **Chủ dự án** (owner): the only one who removes members or changes roles.
    - **Trưởng nhóm** (lead): admits members and manages all tasks, but cannot kick anyone.
    - **Thành viên dự án** (member): self-assigns tasks and moves them to "review", but cannot close them.
    - **Mentor:** comments within an agreed scope.
  - **Staff override:** a Chủ nhiệm (`project.manage_any`) can step into any project, but can never remove the owner.
  - **Links:** https only, public or team-only.
  - **Feedback:** from non-members only, one per person. Approvers can hide feedback; the owner cannot hide criticism.
  - **Analytics** for the owner and lead: views (one per member per day), team, progress, overdue tasks and rating.

## Consequences
- **Tests:** 143 unit and service tests, including permission tests for every role boundary the member listed. Every hub flow was browser-tested on a 375 px viewport with the demo accounts from `npm run db:seed`.
- **Seed:** `scripts/seed-hubs.ts` deliberately seeds **no** courses, listings or projects. Content comes from members, so no business data is invented (AGENTS rule 8).
- **Not built yet:** paid collaboration (Q08), VNPAY, image/file uploads (links only) and notifications for hub events.

## Addendum (20/11/2026): sign-in screens SYS-02…06
- **Login / register** (`/login`, `/register`): one screen with the tabs Đăng nhập / Đăng ký, plus Google / Facebook, email + password, "Ghi nhớ đăng nhập" and "Quên mật khẩu?".
  - Ticked: 30-day cookie. Unticked: browser-session cookie whose token expires after 12 h.
- **Social sign-in** (`/api/auth/oauth/{google|facebook}/{start|callback}`):
  - Server-side authorization-code flow. State and the PKCE verifier are sealed in a 10-minute httpOnly cookie, and secrets stay on the server.
  - A provider without keys is shown disabled with a reason.
  - An existing account is linked only when the provider verified the email (Google). Facebook emails never auto-link, which prevents account takeover.
- **Login states:**
  - Field validation.
  - An identical message for an unknown email and a wrong password.
  - A remaining-attempts warning, then a 15-minute block with a countdown (5 failures per email, 20 per IP).
  - Locked and unverified are only revealed after a correct password.
- **Forgot / reset / verify** (`/forgot-password`, `/reset-password`, `/verify-email`):
  - Tokens are single use and stored hashed: reset lasts 30 minutes, verification 24 hours.
  - The forgot-password answer is the same whether or not the email exists.
  - A reset bumps `members.session_version`, which signs out every device.
  - Verification is a POST from the page, so mail scanners that prefetch links cannot use it up.
- **Configuration:**
  - `PFC_PUBLIC_URL`
  - `GOOGLE_CLIENT_ID/SECRET`, `FACEBOOK_APP_ID/SECRET`
  - `PFC_MAIL_MODE` (`log` for dev, `resend` with `RESEND_API_KEY` / `PFC_MAIL_FROM` for production)
  - `PFC_REQUIRE_EMAIL_VERIFICATION=1`

## Addendum (20/11/2026): G1 account & profile, G2 notifications & search
- **Sessions per device.**
  - Every sign-in is a `member_sessions` row, and the session token carries its id.
  - `currentMember()` refuses revoked rows. This powers the device list and "Đăng xuất tất cả thiết bị khác" (mockup 269).
  - Sessions from before this change need one new login.
- **Two-step login (268).**
  - TOTP (RFC 6238, tested against the RFC vectors) plus 8 hashed backup codes. The secret is AES-256-GCM encrypted with `PFC_ENCRYPTION_KEY`.
  - Codes cannot be replayed, and only failed attempts count toward the limit (5 per 15 minutes).
  - Password and Google/Facebook sign-in both stop at `/login/2fa` (signed 5-minute challenge cookie) until the code is right.
- **Profile (266).**
  - Avatars are square-cropped and stripped of metadata.
  - Changing the email needs the password and a link sent to the new address; the old address is warned.
- **Privacy (272).** Only enforced options: hidden from member search, and not findable by email (project invites).
- **Data (275).**
  - JSON export of the member's own data.
  - Deletion anonymises the account and deletes personal data, but keeps records other members depend on.
  - Deletion is blocked for the last Chủ nhiệm, open orders and active projects.
- **Consent.** The terms version is recorded at sign-up.
- **Policies (274).** Drafts written from actual behaviour, with a visible "cần PFC/pháp chế duyệt" banner.
- **Other G1 screens.** Landing (SYS-01, live counts), onboarding (SYS-07, interests reorder Home), help/FAQ, language (only Vietnamese is translated; others are marked "Sắp có").
- **Notifications (NOT-01…05).**
  - `notify()` stores the in-app item, then sends email and Web Push via `after()` according to per-category × channel preferences. Security notices are always in-app and by email.
  - **Events wired:**
    - **Marketplace:** new order, status changes, listing and seller decisions.
    - **Dự án:** join requests, accept/decline, invite, removal, approval, task assigned, feedback.
    - **Học tập:** content approval, replies to your thread.
    - **Account:** new sign-in, password change/reset, 2FA on/off, email change.
  - **Web Push:** VAPID (`web-push`); the subscribe endpoint only accepts real browser push services.
- **Search (SYS-09/10).** Courses, resources, forum, listings, projects, verified opportunities (public Opportunity API), members (privacy-aware) and the member's own transactions. Recent searches stay on the device.
- **Security upgrades in the same change.**
  - Next.js 15.5.29 in all three apps (React flight RCE advisory).
  - sharp 0.35.5 (libvips CVEs).
  - @vercel/blob 2.4.0.
  - Remaining audit items: vitest and zod need major upgrades, and Next's internal postcss copy is outside our control.

## Addendum (20/11/2026): G3 Community, G4 Events, G5 Payments
- **Community (COM-*, migration v9).** `src/modules/community`: feed (latest / following / top / saved / mine; topic, #tag, search), posts with images and polls, comments with replies, likes, saves, follow, block, member directory, 1-to-1 messages (polling, privacy option "ai được nhắn cho tôi"), reports and a moderation queue (`community.moderate`: BĐH, TB Truyền thông, Chủ nhiệm).
  - **Groups are member-run and separate from the official Câu lạc bộ.** Public or private (join requests). Roles: owner, moderator, member. Moderators admit members and hide content; only the owner removes members, and removal bans them from re-joining.
  - Hidden posts and comments stay visible to their author and moderators with the reason; blocking hides content both ways and stops messages.
- **Events (EVT-*, migration v10).** `src/modules/events`: any member organizes; `draft → submitted → published` needs `event.approve` (BĐH, TB Sự kiện), and approvers publish directly. Reject and cancel need a reason.
  - Up to 6 ticket types; capacity is checked per type and per event inside one write transaction. Paid tickets with VNPAY hold the seat for 15 minutes; "thu tại quầy" (`pay_at_door`) confirms at once and check-in asks the door to collect first.
  - Tickets carry a random 12-character code (QR `PFC-EVT:<code>`); check-in by camera (`BarcodeDetector`, `Permissions-Policy camera=(self)`) or by typing the code; each ticket checks in once. Online links are shown only to confirmed attendees.
  - Cancelling an event cancels every registration and refunds online-paid tickets automatically. Organizer dashboard, attendee CSV (formula-injection safe), day-before reminders, auto-complete via the daily job.
- **Payments (PAY-*, migrations v11–v12).** `src/modules/payments`: VNPAY v2.1.0 (HMAC-SHA512, sorted params). Return URL and IPN both verify signature, merchant code and amount, and apply the result exactly once (`status = 'pending'` guard). Payments, items, events, refunds (with timeline), payouts.
  - Modules plug in through `PaymentHooks` (`onPaid / onFailed / onRefunded / refundCheck / releasable / describe`), loaded lazily to avoid import cycles: `market/server/payment-hooks.ts`, `events/server/payment-hooks.ts`.
  - **Marketplace:** checkout offers VNPAY when configured; VNPAY orders reach the seller only once paid, cannot be marked paid by hand, unpaid ones are cancelled and their stock returned (IPN failure or the daily job); a paid order cancelled by either side is refunded automatically.
  - **Refunds** are requested by the payer and decided by the payee (seller / organizer) or `payments.manage` (Chủ nhiệm); rejecting needs a reason. Approval calls the VNPAY refund API; if that is unavailable the refund stays "processing" until the Chủ nhiệm records the bank-transfer reference.
  - **Payouts:** PFC holds the money until the order is completed or the event has ended; the Chủ nhiệm creates a payout for releasable items and marks it paid with the transfer reference. Platform fee `PFC_PLATFORM_FEE_BPS` (default 0).
  - **Not built:** a PFC wallet (top-up / withdraw) — that needs an e-wallet licence. Real-money production needs a VNPAY merchant contract in PFC's legal name.
- **Jobs.** `/api/jobs/tick` (`Authorization: Bearer CRON_SECRET`, daily Vercel Cron): expire abandoned payments and VNPAY orders, event reminders, complete finished events.
- **Decisions taken without a PFC answer (to confirm):** groups separate from the Club; VNPAY sandbox until keys exist; fee 0; payee decides refunds; payee cancellation refunds automatically; paid events may collect at the door.

## Addendum (21/11/2026): G6 hub completion, G7 rewards, G8 admin console (migration v13)
- **Settings & flags (`src/platform/settings`).** `app_settings` holds feature flags (community, messages, events, places, collab, rewards), point rules and tiers. Flags are checked in hub layouts (`FeatureOff` screen) and in services. Defaults for points and tiers are *proposals*; the admin page marks them until the Chủ nhiệm saves.
- **Restrictions (`src/platform/admin/restrictions.ts`).** Time-limited, reasoned restrictions (community posting, messages, selling, hosting events), enforced inside the services through `assertAllowed()`. Restricting someone with an equal or higher role needs the Chủ nhiệm; nobody restricts a Chủ nhiệm; lock (ban) stays Chủ nhiệm-only.
- **G6 Finance.** Investment tracker (`fin_holdings`, owner-only, prices entered by the member, no market feed, labelled "không phải tư vấn đầu tư"). Rule-based insights from the member's own data, shown on the dashboard and `/finance/insights`. "Ngon – Bổ – Rẻ" places (`fin_places`, reviews, saves): member content, `places.moderate` hides with a reason, maps open via address (no tiles, no coordinates stored).
- **G6 Learning.** Timed quizzes (`time_limit_min`): the clock starts on the server (`edu_attempt_starts`), late submissions beyond a 60 s grace are refused, the runner auto-submits at zero. Learning badges computed from progress.
- **G6 Projects.** "Tìm cộng sự" profiles (`prj_collab_profiles`): opt-in, hidden when the profile is private; contact through PFC messages.
- **G7 Rewards (`src/modules/rewards`).** Append-only `pts_ledger`; each (rule, reference) earns once (unique index) within a daily cap. Earned on course completion, quiz pass, event check-in, community post, product review, place review, referral (credited when the referee finishes onboarding; link `/r/<code>` sets a 30-day cookie). Tier = lifetime earned points, so redeeming never lowers it. Catalog managed by `rewards.manage`; redemption checks balance, stock and tier in one transaction; cancelling refunds points. Manual adjustments need a reason and are audited.
- **G8 Admin (`/admin`, `src/platform/admin/console.ts`).** Dashboard (KPIs, system status, every hub's queue filtered by permission), member detail (activity, restrictions, points), audit log with security and data-request views, broadcast notifications by role/department (in-app links only, rate-limited), support tickets (member ↔ staff), configuration. New permissions: `admin.dashboard`, `admin.audit.view`, `admin.members.restrict`, `admin.broadcast`, `admin.support`, `admin.settings.manage`, `rewards.manage`, `places.moderate` (BĐH gets all but settings; TB Truyền thông gets broadcast and places moderation).
- **Not built (needs PFC input or outside data):** receipt photo/OCR, live market prices, Marketplace services and course sales, paid project collaboration, notification templates beyond one-off broadcasts, in-app backup/restore (Turso point-in-time restore is documented in DEPLOY.md §11).

## Addendum (22/11/2026): listings, opportunity posting rights, member contributions (migration v14)
- **Marketplace listings.** Five types (`LISTING_TYPES`): physical product, digital product, service, course (linked to the seller's own published Học tập course), event ticket (linked to an event the seller organizes; bought on the event page, price "từ" the cheapest ticket type). Tags (≤ 8, normalized), integer VND with an explicit `currency = 'VND'`, up to 6 server-processed photos. `mkt_listings` was rebuilt to widen the type CHECK (rows preserved).
- **Risk-based seller verification.** A verified email opens a *basic* shop at once: physical / digital items up to `basicMaxPrice` and `basicMaxListings` active listings (Quản trị → Cấu hình; defaults 2.000.000₫ / 10 are proposals). Services, courses, tickets and higher prices need the *verified* level: the seller submits real name + phone + what they sell, `mkt.seller.approve` decides with a reason. Every listing is still reviewed before it is public.
- **Opportunity posting (DEC-09).** PFC App passes `pfc_role` / `pfc_department` in the SSO token, and the hub session is bound to the role, so changes apply on the next request. Opportunity Hub maps Trưởng ban → PROVIDER ("<Ban> · PFC"), Ban điều hành / Chủ nhiệm → REVIEWER who may also post ("Ban điều hành PFC"); both are Trusted Partners. Profiles granted this way have status `platform` and are withdrawn when the PFC role goes; roles assigned inside the hub are never lowered. Trusted Partner submissions go straight to Verified (`statusOnSubmit`) and appear in the reviewer's 14-day post-review list, where they can be taken down with a reason.
- **Học tập contributions.** Every member can create courses, quizzes and documents (10 new items/day unless `edu.content.create`); everything stays draft until an approver publishes it. Documents can be uploaded as PDF (≤ 4 MB — the Vercel request limit; magic bytes checked; files with JavaScript, launch actions or embedded files refused; served with a sandbox CSP) or linked over https. Forum comments can be answered (one level), and the comment author is notified.

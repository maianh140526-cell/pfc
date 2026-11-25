# PFC Digital Hub — Nghiên cứu hiện trạng & định hướng Mobile Web App (app-like)

> Ngày khảo sát: 19/11/2026. Nguồn: `source/` (SRS v3.0, Screen Inventory, Checklist, 20 ảnh mockup = 275 màn hình), `PFC-Management/`, `PFC-Opportunity Hub/`, `PFC-Personal Finance/`, `.cursor/rules`, ADR-001…008.
> Mục tiêu: mở trên trình duyệt điện thoại thấy và dùng **như một ứng dụng mobile**.
> File này là tài liệu nghiên cứu. Quyết định đã chốt nằm ở [ADR-009](./PFC-App/docs/adr/ADR-009-unified-mobile-app-shell.md).
>
> **Trạng thái (19/11/2026):** DEC-M1 (một App Shell) và DEC-M2 (Finance chuyển sang web) — **đã đồng ý**. DEC-M4 (màu/font) và DEC-M5 (5 tab) — **tạm dùng** theo mockup, chờ brand kit. DEC-M3 (identity) — làm ở P2. **P1 đã xong** trong `PFC-App/`. **P3 (Finance) và giao diện riêng cho Cơ hội + Câu lạc bộ đã xong** — xem [ADR-010](./PFC-App/docs/adr/ADR-010-hub-interiors-and-data.md). P2 mới làm phần tài khoản PFC; đăng nhập một lần cho mọi nhánh còn lại.

---

## 1. Tóm tắt một đoạn

Tài liệu và mockup của PFC **đã là mobile-first**: 275 màn hình đều là khung điện thoại, có bottom tab bar, onboarding, dark mode, OTP, ví điểm… Code hiện có **3 app rời, 3 stack, 3 hệ đăng nhập, 3 bảng màu**. Club là app gần "app-like" nhất (có khung phone, safe-area, 100dvh) nhưng vẫn **chưa phải PWA**: không manifest, không service worker, không icon cài đặt, icon dùng emoji. Personal Finance — nhánh "entry point" theo SRS — lại viết bằng **Flutter Web**, là lựa chọn yếu nhất cho web trên điện thoại. Việc quan trọng nhất là **gom về một App Shell PWA duy nhất** trước khi làm thêm module.

---

## 2. Hiện trạng theo từng thành phần

### 2.1 Tài liệu nghiệp vụ (`source/`)

| Tài liệu | Nội dung chính | Ý nghĩa cho mobile web |
|---|---|---|
| SRS v3.0 | 6 hub + Platform Core, FR-CORE/FIN/EDU/PROJ/MKT/OPP/CLB/X, NFR FURPS+, 20 quyết định Q01–Q20 | A01: "Web app responsive là Presentation Layer chính; native chưa xác định" → **web app là kênh chính** |
| SRS Q14 | Notification Production Launch: In-app + Email + **Push** | Trên iPhone, Web Push **chỉ chạy khi web được "Thêm vào màn hình chính"** (iOS ≥ 16.4) → PWA là điều kiện bắt buộc |
| SRS Q13 / Q12 | Export CSV/XLSX/PDF; nhập tay + import CSV/sao kê | Cần màn hình import/export thân thiện chạm |
| SRS Q18 | 100.000 member, 10.000 phiên đồng thời | Ngân sách hiệu năng, cache, CDN |
| SRS NFR-P | p95 ≤ 2s đọc, ≤ 3s ghi | Trên 4G cần JS nhẹ, SSR/RSC |
| Screen Inventory | ~330 Screen ID (SYS, FIN, EDU, PRO, OPP, MKT, SELL, PAY, COM, EVT, MEM, NOT, SRCH, ADM) + 18 state chung (loading, empty, offline, session expired…) | "Offline / network error" đã là state bắt buộc |
| Mockup (20 ảnh) | 275 màn hình, khung iPhone, tông tím, nền trắng/tím nhạt, bo góc lớn | **Nguồn sự thật về UI** |

**Hệ điều hướng trong mockup** (lặp lại trên hầu hết màn):

- Bottom tab 5 mục: `Home · Finance · Learn · Notifications/Community · More` (tab giữa đổi theo ngữ cảnh: `Projects`, `Opportunities`, `Marketplace`, `Discover`, `Benefits`, `Events`).
- Header: nút back trái, tiêu đề đậm, action phải (chuông, share, +, filter).
- Nút CTA chính full-width màu tím ở đáy màn hình; FAB tròn "+".
- Segmented tabs dạng pill (Tất cả / Thu / Chi / Tháng này).
- Màn có sẵn: onboarding 3 bước (92–94), chọn ngôn ngữ (100), **Sáng / Tối / Tự động** (101), cài đặt thông báo (102), mời bạn, ví điểm, đổi quà (103–106), admin mobile (265–275).

### 2.2 Club Management — `PFC-Management/apps/club`

| Hạng mục | Hiện trạng |
|---|---|
| Stack | Next.js 15, React 19, Drizzle, SQLite local / Turso prod, Zod, Vitest, Playwright, Tailwind 4 (nhưng UI chủ yếu dùng `globals.css` ~3.000 dòng CSS tự viết) |
| Kiến trúc | Rất tốt: `domain/` thuần (FSM, policy), `server/` use-case, `lib/authz`, audit, rate-limit, flags, ADR G0–G8 |
| Mobile shell | `layout.tsx` có `viewportFit: "cover"`; `.phone-frame` max 390px, `100dvh`, `env(safe-area-inset-bottom)`; desktop hiện khung điện thoại bo góc giữa nền tối |
| Bottom nav | 4 mục **emoji** (🏠📢📋⚙️) — lệch mockup (5 mục, icon line) |
| Lobby | `/lobby` = "Phòng khách" liệt kê 6 nhánh (`domain/hub-branches.ts`): Finance mở app Flutter ngoài (`127.0.0.1:8080`), Opportunity mở app ngoài, 3 nhánh "sắp có" |
| Auth | Cookie HMAC riêng + Google OAuth (đang làm, chưa commit) + SSO consumer theo ADR-008 |
| PWA | **Không có**: không `manifest`, không service worker, không `apple-touch-icon`, không `theme-color` |

### 2.3 Opportunity Hub — `PFC-Opportunity Hub/web`

| Hạng mục | Hiện trạng |
|---|---|
| Stack | Next.js 15 (Turbopack), Prisma + SQLite dev, Tailwind 4, **lucide-react**, Zod, nodemailer, job worker |
| Kiến trúc | Pack kiến trúc đầy đủ (C4, data-model, ADR-001…004), domain/server tách bạch |
| Mobile shell | `.pfc-phone` max 430px, `100dvh`, `BottomNav` riêng, font Geist |
| Auth | bcrypt + session riêng (thứ hai) |
| PWA | Không có |

### 2.4 Personal Finance (Quỹ) — `PFC-Personal Finance`

| Hạng mục | Hiện trạng |
|---|---|
| Stack | Flutter ^3.6 + Firebase Auth + Firestore, `fl_chart`, `provider` (~5.700 dòng màn hình) |
| Chức năng | Giao dịch, ngân sách, báo cáo, mục tiêu/thử thách tiết kiệm, công cụ: lãi kép, vay, hưu trí, so sánh lãi suất, thuế TNCN |
| Bảo mật dữ liệu | `firestore.rules` owner-only cho mọi collection — đúng BR-009 |
| Brand | `PfcBrand.primary = #5841A5` ("brand kit v1") |
| Web | `web/manifest.json` vẫn là **mặc định Flutter** (`finance_app`, màu xanh `#0175C2`) |
| Auth | Firebase Auth (thứ ba) — vi phạm FR-X-001 "một Member ID xuyên module" |
| Máy hiện tại | Không cài Flutter SDK → chưa chạy được ở đây |

### 2.5 Ba nhánh chưa có code

Education Hub, Project Marketplace, Marketplace (+ Shared Event Engine, Payment, Admin Portal). Club có stub `event-hub-stub.ts` và trang `/hubs/education`, `/hubs/project` dạng placeholder.

### 2.6 Thư mục khác

- `BeeCount-Cloud/` (docker-compose tham khảo), `Test/` (backtest VN30F1M Python — không thuộc PFC Hub), `awesome-architecture-main/` (tài liệu tham khảo, untracked).
- `DATA/` là bản sao của `source/` + ảnh QA của Club (untracked).
- Không có file bí mật nào bị track trong git (`.env`, `.env.local`, `dev.db`, `.sqlite` đều nằm ngoài index).

---

## 3. Khoảng cách so với "trông và dùng như app"

| # | Tiêu chí app-like | Club | Opportunity | Finance (Flutter web) |
|---|---|---|---|---|
| 1 | Cài lên màn hình chính (manifest + icon 192/512 + maskable) | ✗ | ✗ | △ (manifest mặc định) |
| 2 | Mở full-screen, không thanh địa chỉ (`display: standalone`) | ✗ | ✗ | △ |
| 3 | Màu status bar / `theme-color`, `apple-mobile-web-app-*` | ✗ | ✗ | ✗ |
| 4 | Service worker: mở được khi mất mạng, màn hình "Offline" | ✗ | ✗ | △ (SW Flutter mặc định) |
| 5 | Safe-area (tai thỏ, home indicator), `100dvh` | ✓ | △ | ✓ |
| 6 | Bottom tab bar cố định, đúng mockup 5 mục | △ (4 emoji) | △ | △ (4 tab) |
| 7 | Icon vector thống nhất | ✗ emoji | ✓ lucide | ✓ Material |
| 8 | Chuyển trang mượt (View Transitions / slide) | ✗ | ✗ | ✓ |
| 9 | Bottom sheet thay modal, FAB "+", phản hồi chạm | △ | △ | ✓ |
| 10 | Skeleton loading, optimistic UI | △ | △ | △ |
| 11 | Bàn phím số khi nhập tiền (`inputmode="decimal"`), định dạng VND | n/a | n/a | ✓ |
| 12 | Web Push (bắt buộc Q14) | ✗ (adapter stub) | ✗ | ✗ |
| 13 | Dark mode (mockup 101) | ✗ | ✗ | ✗ |
| 14 | Một lần đăng nhập cho cả hub | ✗ | ✗ | ✗ |
| 15 | Tải lần đầu nhanh trên 4G | ✓ | ✓ | ✗ (Flutter web tải engine vài MB) |
| 16 | Gõ tiếng Việt (Telex/VNI) ổn định trên mobile browser | ✓ | ✓ | ⚠ Flutter web có lịch sử lỗi IME |

---

## 4. Vấn đề cấu trúc cần quyết định (DEC)

**DEC-M1 — Một App Shell hay nhiều app?**
Người dùng điện thoại không chấp nhận việc bấm "Finance" rồi bị đưa sang domain/port khác với giao diện, font và đăng nhập khác. Trải nghiệm "như app" cần **một origin, một shell, một bottom nav, một phiên đăng nhập**.
→ Đề xuất: **một Next.js App Shell (PWA)** làm Presentation Layer, mỗi hub là một bounded module bên trong (`src/modules/<hub>/{domain,server,ui}`). Cách này khớp ADR-001 "modular monolith, một deployable", và giữ được biên giới module như CLUB.md yêu cầu. Club và Opportunity đã cùng stack Next 15 / React 19 nên gom được.

**DEC-M2 — Personal Finance: giữ Flutter hay chuyển sang web stack?**
SRS gọi Finance là *entry point* (P2 Finance-first). Đặt nhánh quan trọng nhất trên Flutter Web là rủi ro cho mục tiêu mobile web: tải lần đầu nặng, SEO kém, chọn/copy chữ kém, IME tiếng Việt từng có lỗi, khó dùng chung shell/nav/session với các module Next.js.
→ Đề xuất: **viết lại phần UI Finance trong App Shell Next.js** (logic tính toán, model và rule Firestore đã có là đặc tả tốt để port). Flutter giữ làm nhánh **native Android** về sau nếu thật sự cần, hoặc dừng.
→ Kèm theo: chọn kho dữ liệu Finance (Firestore hiện tại vs DB trung tâm Postgres/Turso như SRS §11 "Centralized Database"). Cần chốt.

**DEC-M3 — Identity thống nhất (FR-X-001).** Hiện có 3 hệ đăng nhập. Platform Core cần một Member ID + một session cookie cho cả shell. ADR-008 nói Club chỉ *consume* SSO → cần một module `platform/identity` trong App Shell làm IdP nội bộ (email/mật khẩu + Google như mockup 2–3, OTP như mockup 6/98).

**DEC-M4 — Bảng màu & font chuẩn.** Đang có 3 màu primary: Club `#7C3AED`, Flutter brand kit `#5841A5`, mockup (tím–indigo sáng hơn). Font: Plus Jakarta Sans (Club) vs Geist (Opportunity) vs Material (Flutter). Cần chốt **một bộ design token** từ file brand kit gốc / Figma — không tự chọn màu.

**DEC-M5 — Bottom nav chuẩn.** Mockup dùng 5 tab với tab giữa thay đổi theo hub. Cần chốt bộ tab cố định (đề xuất từ mockup 8/12: `Home · Finance · Learn · Community · More`), các hub còn lại vào qua Home "Quick Access" và More.

---

## 5. Kiến trúc đề xuất cho App Shell

```
pfc-app/ (Next.js 15, App Router, một deployable, PWA)
├─ src/app/
│  ├─ (public)/        landing, login, register, otp, forgot   ← SYS-01…06
│  ├─ (app)/           layout có TabBar + Header + safe-area   ← member app
│  │   ├─ home/        SYS-08
│  │   ├─ finance/…    FIN-*
│  │   ├─ learn/…      EDU-*
│  │   ├─ community/…  COM-* (Club hiện tại chuyển vào đây)
│  │   ├─ opportunities/… OPP-*
│  │   └─ more/…       MEM-*, settings, help
│  ├─ admin/           ADM-* (layout riêng, RBAC riêng)
│  ├─ manifest.ts      Web App Manifest
│  └─ offline/         trang offline
├─ src/modules/<hub>/{domain,server,ui}   ← bounded module, không import chéo
├─ src/platform/      identity, rbac, audit, notify (in-app/email/web-push), storage, jobs
└─ src/ui/            design system: tokens, TabBar, AppHeader, BottomSheet, FAB,
                      ListItem, SegmentedTabs, AmountInput, Skeleton, EmptyState
```

### 5.1 Checklist kỹ thuật "app-like"

**Cài đặt & khung**
- `app/manifest.ts`: `name`, `short_name: "PFC"`, `display: "standalone"`, `start_url: "/home"`, `scope: "/"`, `theme_color`, `background_color`, icon 192/512 + `purpose: "maskable"`, `shortcuts` (vd. "Thêm giao dịch" → `/finance/add`).
- `apple-touch-icon` 180px, `apple-mobile-web-app-capable`, `apple-mobile-web-app-status-bar-style`, splash iOS.
- Viewport: `viewport-fit=cover`; **không** chặn zoom (accessibility) — thay vào đó cho input `font-size ≥ 16px` để iOS không tự phóng to.
- Layout: header sticky + nội dung cuộn + tab bar `position: fixed` với `padding-bottom: env(safe-area-inset-bottom)`; dùng `100dvh`.
- Nút cài: bắt `beforeinstallprompt` (Android/Chrome); iOS hiện bottom sheet hướng dẫn "Chia sẻ → Thêm vào MH chính".
- Ở chế độ standalone trên iOS không có nút back của trình duyệt → **mọi màn con phải có nút back** trong header (mockup đã có).

**Service worker & offline** (vd. Serwist cho Next 15)
- Cache app shell, font, icon, ảnh tĩnh; trang `/offline` khi mất mạng (state "Offline / network error" của Screen Inventory).
- API dữ liệu tài chính cá nhân: **NetworkOnly**, không lưu vào Cache Storage (BR-009, NFR-S-003, Luật BVDLCN 91/2025). Nếu muốn nhập giao dịch khi offline → hàng đợi IndexedDB chỉ chứa bản nháp của chính user, xoá sau khi đồng bộ, có idempotency key (NFR-R-002 chống nhân đôi).
- Đăng xuất phải xoá cache/IndexedDB liên quan.

**Tương tác**
- Bottom sheet thay modal (chọn danh mục, bộ lọc, xác nhận xoá).
- Chuyển trang: View Transitions API (Chrome/Safari 18+), slide-in cho màn con, fade cho đổi tab.
- `touch-action: manipulation`, trạng thái `:active` thu nhỏ nhẹ, vùng chạm ≥ 44px (Flutter brand kit đã quy định `minTouchTarget = 44`).
- `overscroll-behavior` + pull-to-refresh tự làm ở danh sách.
- Skeleton cho dashboard/danh sách; optimistic UI cho lưu/thích/đánh dấu.
- Nhập tiền: `inputmode="decimal"`, định dạng `Intl.NumberFormat('vi-VN')` + hậu tố `₫`.

**Thông báo**
- In-app (đã có ở Club/Opportunity) + Email + **Web Push (VAPID)**. iOS: chỉ hỏi quyền push sau khi user đã cài PWA và bấm chủ động (không hỏi ngay khi mở).

**Hiệu năng (NFR-P)**
- RSC/SSR cho trang đọc; JS client mỗi route mục tiêu < ~200 KB gzip; `next/font` subset `vietnamese`; `next/image`.
- Lighthouse mobile: Performance ≥ 90, PWA installable, Accessibility ≥ 90 làm cổng CI.

**Desktop**
- Giữ kiểu Club: canvas điện thoại ở giữa trên màn rộng, hoặc nâng cấp dần thành layout 2 cột (sidebar thay tab bar) — NFR-U-001 yêu cầu responsive.

---

## 6. Lộ trình đề xuất

| Giai đoạn | Việc | Kết quả kiểm chứng |
|---|---|---|
| **P0 — Chốt** | DEC-M1…M5; xuất token màu/font/radius từ brand kit; danh sách màn hình đợt 1 | ADR-009 "Unified Mobile App Shell" |
| **P1 — Shell PWA** | Tạo App Shell; design system (TabBar, Header, BottomSheet, FAB, ListItem, AmountInput, Skeleton, Empty/Error/Offline); manifest + icon + SW + trang offline; dark mode | Cài được lên iPhone & Android, mở standalone, Lighthouse PWA pass |
| **P2 — Identity** | Platform identity: đăng ký/đăng nhập/OTP/quên mật khẩu (SYS-02…06), onboarding (SYS-07, mockup 92–94), một session | Một tài khoản dùng mọi tab — **đã có** (ADR-011): đăng ký/đăng nhập, Google/Facebook, quên/đặt lại mật khẩu, xác thực email, 2FA, thiết bị đăng nhập, onboarding, hồ sơ, quyền riêng tư, xuất/xóa dữ liệu, SSO sang Club & Opportunity |
| **P3 — Finance (entry point)** | Port Flutter → web: FIN-01 Dashboard, FIN-04/05/07 giao dịch, FIN-08 danh mục, FIN-09/10 ngân sách, FIN-13 mục tiêu, FIN-18/19 báo cáo, FIN-20/21 export/import; công cụ tính toán | Luồng "thêm giao dịch trong ≤ 3 chạm" trên điện thoại |
| **P4 — Gom module** | Chuyển Club → `community/`, Opportunity → `opportunities/` vào shell, giữ nguyên domain/server/test | Bỏ app rời, một bottom nav |
| **P5 — Push & Home** | Web Push, Notification Center (NOT-01), Home dashboard SYS-08 | **Đã có**: Trung tâm thông báo, cài đặt theo kênh, email, Web Push, tìm kiếm toàn app, Home cá nhân hóa (ADR-011). Còn: thử push trên iPhone thật |
| **P6+** | Education, Project, Marketplace, Event, Admin theo SRS roadmap | **Đã có** Education (`/learn`), Marketplace (`/market`), Dự án (`/projects`) + quản trị vai trò (`/more/admin`) — ADR-011. **Đã có thêm (G3–G5):** Cộng đồng (bài viết, nhóm, tin nhắn, kiểm duyệt), Sự kiện (đăng ký, vé QR, check-in, hủy & hoàn tiền), Thanh toán VNPAY (sandbox), hoàn tiền, chi trả cho người bán. **G6–G8:** đầu tư, gợi ý tài chính, Ngon – Bổ – Rẻ, thi tính giờ, huy hiệu, tìm cộng sự, điểm thưởng & hạng, trang quản trị (hàng chờ, nhật ký, hạn chế, cấu hình, thông báo chung, hỗ trợ). Còn: hợp đồng VNPAY production, ví PFC (cần giấy phép), chốt quy tắc điểm & quà đối tác, G9 ra mắt |

---

## 7. Rủi ro chính

| Rủi ro | Giảm thiểu |
|---|---|
| Gom 3 app làm vỡ test/ADR của Club | Chuyển module nguyên khối (domain/server/test giữ nguyên), chỉ thay layer UI & auth adapter |
| iOS giới hạn PWA (push chỉ khi đã cài, storage có thể bị xoá sau 7 ngày không dùng nếu chưa cài) | Thiết kế luồng mời cài app; server là nguồn dữ liệu chính, client chỉ cache |
| Dữ liệu tài chính nằm trong cache trình duyệt | NetworkOnly cho API nhạy cảm; xoá cache khi logout; không lưu PII trong SW |
| Port Flutter tốn công | Ưu tiên màn FIN Must; dùng code Dart làm đặc tả logic tính toán |
| Màu/brand không thống nhất | DEC-M4 trước P1 |

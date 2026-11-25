# Deploy PFC App (Vercel + Turso + Vercel Blob + Resend)

Hướng dẫn cho người không rành devops. Làm đúng thứ tự. PFC App là app chính người dùng mở trên điện thoại; **Câu lạc bộ** và **Cơ hội** là 2 service riêng được PFC App gọi qua gateway.

| Service | Thư mục (Root Directory trên Vercel) | Database |
|---|---|---|
| PFC App | `PFC-App` | Turso (libSQL) |
| Câu lạc bộ | `PFC-Management/apps/club` | Turso — xem [`DEPLOY.md` của Club](../PFC-Management/apps/club/DEPLOY.md) |
| Cơ hội | `PFC-Opportunity Hub/web` | Turso qua Prisma driver adapter — xem mục 9 |

---

## Checklist nhanh

- [ ] Tạo database Turso cho PFC App, có URL + token
- [ ] Tạo Blob store trên Vercel (lưu ảnh)
- [ ] Tạo tài khoản Resend, xác minh tên miền gửi email
- [ ] Sinh 3 secret ngẫu nhiên (phiên đăng nhập, SSO Club, SSO Cơ hội)
- [ ] Deploy Club và Cơ hội trước, ghi lại địa chỉ https của chúng
- [ ] Tạo project Vercel cho PFC App, đặt biến môi trường
- [ ] Mở `https://<app>/api/health` thấy `"ok": true`
- [ ] Đăng ký tài khoản Chủ nhiệm đầu tiên bằng email trong `PFC_OWNER_EMAILS`

---

## 1. Sinh secret

Chạy lệnh này 4 lần, mỗi lần copy một chuỗi:

```bash
node -e "console.log(require('crypto').randomBytes(48).toString('base64url'))"
```

- `PFC_SESSION_SECRET` — chỉ PFC App dùng.
- `CLUB_SSO_SECRET` — **giống hệt** `PLATFORM_SSO_SHARED_SECRET` bên Club.
- `OPP_SSO_SECRET` — **giống hệt** `OPP_SSO_SHARED_SECRET` bên Cơ hội.

- `PFC_ENCRYPTION_KEY` — mã hóa khóa xác thực hai lớp. **Cất giữ cẩn thận**: mất hoặc đổi khóa này thì mọi người phải bật lại 2FA.

Bốn chuỗi phải khác nhau. Không bao giờ đưa secret lên GitHub.

## 2. Turso (database)

1. Vào https://turso.tech → tạo database, ví dụ `pfc-app` (chọn vùng gần Việt Nam, ví dụ Singapore).
2. Lấy **URL** `libsql://pfc-app-xxxx.turso.io` → `PFC_DB_URL`.
3. Tạo **token** đọc/ghi → `PFC_DB_AUTH_TOKEN`.

App tự tạo bảng (migration) ở lần chạy đầu tiên, không cần chạy lệnh migrate riêng.

> Sao lưu: Turso có point-in-time restore theo gói đang dùng. Trước mỗi lần deploy có migration mới, tạo bản sao: `turso db create pfc-app-backup-YYYYMMDD --from-db pfc-app`.

## 3. Vercel Blob (ảnh tải lên)

Trong project Vercel → **Storage** → **Create** → **Blob** → kết nối vào project. Vercel tự thêm `BLOB_READ_WRITE_TOKEN`. Đặt thêm `PFC_STORAGE=blob`.

Ảnh được máy chủ kiểm tra, thu nhỏ ≤ 1600 px, đổi sang WebP và **xóa thông tin vị trí GPS** trước khi lưu.

## 4. Resend (email xác thực / quên mật khẩu)

1. Tạo tài khoản https://resend.com, thêm và xác minh tên miền (thêm bản ghi DNS theo hướng dẫn).
2. Tạo API key → `RESEND_API_KEY`.
3. `PFC_MAIL_FROM` = ví dụ `PFC <no-reply@ten-mien-cua-ban>`; `PFC_MAIL_MODE=resend`.

## 5. Tạo project Vercel

1. https://vercel.com → **Add New Project** → chọn repo PFC.
2. **Root Directory:** `PFC-App`. Framework: Next.js. Build/Install: để mặc định.
3. Chưa bấm Deploy — đặt biến môi trường trước (mục 6).

## 6. Biến môi trường (Production)

| Biến | Giá trị |
|---|---|
| `PFC_SESSION_SECRET` | Secret 1 |
| `CLUB_SSO_SECRET` | Secret 2 (trùng bên Club) |
| `OPP_SSO_SECRET` | Secret 3 (trùng bên Cơ hội) |
| `PFC_ENCRYPTION_KEY` | Secret 4 |
| `PFC_DB_URL` | `libsql://…` |
| `PFC_DB_AUTH_TOKEN` | token Turso |
| `PFC_PUBLIC_URL` | `https://<tên-miền-app>` |
| `CLUB_API_ORIGIN` | `https://<địa-chỉ-club>` |
| `OPP_API_ORIGIN` | `https://<địa-chỉ-cơ-hội>` |
| `PFC_OWNER_EMAILS` | email Chủ nhiệm đầu tiên, ví dụ `chunhiem@...` |
| `PFC_MAIL_MODE` | `resend` |
| `RESEND_API_KEY` | khóa Resend |
| `PFC_MAIL_FROM` | `PFC <no-reply@...>` |
| `PFC_STORAGE` | `blob` |
| `BLOB_READ_WRITE_TOKEN` | (Vercel tự thêm ở mục 3) |
| `PFC_VAPID_PUBLIC_KEY` / `PFC_VAPID_PRIVATE_KEY` | Tạo một lần: `node -e "console.log(require('web-push').generateVAPIDKeys())"` (trong thư mục PFC-App). Không đổi về sau, nếu không mọi người phải bật lại thông báo đẩy |
| `PFC_VAPID_SUBJECT` | `mailto:<email liên hệ của PFC>` |
| `PFC_REQUIRE_EMAIL_VERIFICATION` | `1` nếu muốn bắt xác thực email trước khi đăng nhập |
| `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` | tùy chọn — mục 8 |
| `FACEBOOK_APP_ID` / `FACEBOOK_APP_SECRET` | tùy chọn — mục 8 |
| `CRON_SECRET` | chuỗi ngẫu nhiên ≥ 16 ký tự — việc định kỳ `/api/jobs/tick` (mục 8b) |
| `VNPAY_TMN_CODE` / `VNPAY_HASH_SECRET` | tùy chọn — thanh toán trực tuyến, mục 8b |
| `VNPAY_PAY_URL` / `VNPAY_API_URL` | bỏ trống = sandbox; production dùng địa chỉ VNPAY cấp |
| `PFC_PLATFORM_FEE_BPS` | phí nền tảng (100 = 1%); bỏ trống = 0 |

**Bên Club** thêm: `PLATFORM_SSO_MODE=oidc`, `PLATFORM_SSO_SHARED_SECRET=<Secret 2>`.
**Bên Cơ hội** thêm: `OPP_SSO_SHARED_SECRET=<Secret 3>`.

Không đặt `PFC_INSECURE_COOKIES` hay `PFC_ENV` trên production.

## 7. Deploy & kiểm tra

1. Bấm **Deploy**.
2. Mở `https://<app>/api/health`:
   - `"database": "up"`, `"config": "ok"`, `hubs.club` và `hubs.opportunity` là `"up"` → xong.
   - `"config": "incomplete"` → vào **Vercel → Logs**, tìm dòng `[config]`: log ghi tên biến còn thiếu (không ghi giá trị).
3. Đăng ký tài khoản bằng email trong `PFC_OWNER_EMAILS` → tài khoản này là Chủ nhiệm, vào **Thêm → Quản lý tài khoản** để phân vai trò cho người khác.
4. Mở app trên điện thoại → **Thêm vào màn hình chính** để cài như app.

Lỗi lúc chạy được ghi thành một dòng JSON `"kind":"request_error"` trong Vercel Logs (chỉ có mẫu đường dẫn, không có id hay token).

## 8. Đăng nhập Google / Facebook (tùy chọn)

- **Google:** https://console.cloud.google.com → APIs & Services → Credentials → **OAuth client ID** (Web application). Authorized redirect URI: `https://<app>/api/auth/oauth/google/callback`.
- **Facebook:** https://developers.facebook.com → tạo app → **Facebook Login** → Valid OAuth Redirect URI: `https://<app>/api/auth/oauth/facebook/callback`. Cần quyền `email`.

Chưa đặt khóa thì nút tương ứng hiện mờ kèm lời giải thích; đăng nhập bằng email vẫn chạy.

## 8b. Thanh toán VNPAY & việc định kỳ (tùy chọn)

Không đặt `VNPAY_*` thì app vẫn chạy: Chợ dùng COD / chuyển khoản trực tiếp, vé có phí thu tại quầy.

1. **Sandbox:** đăng ký tài khoản thử nghiệm tại https://sandbox.vnpayment.vn/devreg → nhận `vnp_TmnCode` và `vnp_HashSecret` → đặt `VNPAY_TMN_CODE`, `VNPAY_HASH_SECRET`.
2. Khai báo với VNPAY: **IPN URL** `https://<app>/api/payments/vnpay/ipn` (bắt buộc — tiền được ghi nhận qua IPN kể cả khi người mua đóng trình duyệt). Return URL app tự gửi: `https://<app>/api/payments/vnpay/return`.
3. **Production (tiền thật):** cần hợp đồng merchant với VNPAY đứng tên pháp nhân thu tiền; đặt `VNPAY_PAY_URL` / `VNPAY_API_URL` theo địa chỉ VNPAY cấp. PFC giữ tiền khách trả rồi chi trả cho người bán / ban tổ chức khi đơn hoàn tất hoặc sự kiện kết thúc (Thêm → Thanh toán → Quản lý thanh toán). Ví PFC (nạp / rút) **không** được làm vì cần giấy phép ví điện tử.
4. **Việc định kỳ:** `vercel.json` gọi `/api/jobs/tick` mỗi ngày 01:00 UTC (gói Hobby chỉ cho 1 lần/ngày): hết hạn giao dịch bỏ dở, hủy đơn VNPAY chưa trả (trả hàng về kho), nhắc lịch sự kiện ngày mai, đóng sự kiện đã qua. Muốn chạy dày hơn (khuyên 15 phút/lần khi bật VNPAY): gói Pro sửa `schedule` thành `*/15 * * * *`, hoặc dùng dịch vụ cron ngoài gọi `GET https://<app>/api/jobs/tick` với header `Authorization: Bearer <CRON_SECRET>`.

## 9. Deploy Cơ hội (Opportunity Hub)

Quyết định: [ADR-005](../PFC-Opportunity%20Hub/adrs/ADR-005-turso-libsql-serverless.md). Máy dev vẫn dùng file SQLite như cũ; production dùng Turso.

1. **Turso:** tạo database riêng, ví dụ `pfc-opportunity`, lấy URL + token.
2. **Tạo bảng trên Turso** (một lần, trên máy bạn):
   ```bash
   cd "PFC-Opportunity Hub/web"
   npm install
   TURSO_DATABASE_URL=libsql://pfc-opportunity-xxxx.turso.io TURSO_AUTH_TOKEN=<token> npm run db:turso:migrate
   ```
   Trên Windows PowerShell: đặt `$env:TURSO_DATABASE_URL=...` và `$env:TURSO_AUTH_TOKEN=...` trước rồi chạy `npm run db:turso:migrate`.
3. **Dữ liệu demo (chỉ cho database demo):** `npm run db:seed` sẽ **xóa toàn bộ dữ liệu** rồi tạo dữ liệu mẫu. Với Turso, script từ chối chạy trừ khi đặt thêm `OPP_SEED_CONFIRM=wipe:<host-của-database>`. Không chạy trên database thật.
4. **Vercel:** project mới, **Root Directory** `PFC-Opportunity Hub/web`. Biến môi trường:

   | Biến | Giá trị |
   |---|---|
   | `TURSO_DATABASE_URL` / `TURSO_AUTH_TOKEN` | từ bước 1 |
   | `DATABASE_URL` | `file:./dev.db` (chỉ để `prisma generate` lúc build; khi có Turso app không dùng) |
   | `OPP_FILE_STORAGE` | `db` — CV lưu trong database (Vercel không có ổ đĩa lâu dài) |
   | `CRON_SECRET` | chuỗi ngẫu nhiên ≥ 16 ký tự (Vercel Cron tự gửi kèm) |
   | `CV_SIGNING_SECRET` | chuỗi ngẫu nhiên ≥ 16 ký tự |
   | `OPP_SSO_SHARED_SECRET` | trùng `OPP_SSO_SECRET` của PFC App |

5. **Job nhắc hạn / hết hạn:** `vercel.json` đã lên lịch `/api/jobs/tick` mỗi ngày lúc 01:00 UTC (giới hạn gói Hobby). Gói Pro có thể đổi lịch thành mỗi 15 phút.
6. **Thay đổi schema về sau:** sửa `prisma/schema.prisma`, chạy `npx prisma db push` cho máy dev, rồi tạo file SQL mới cho Turso:
   ```bash
   npx prisma migrate diff --from-url "file:./turso-snapshot.db" --to-schema-datamodel prisma/schema.prisma --script > prisma/turso-migrations/0002_ten-thay-doi/migration.sql
   ```
   (`turso-snapshot.db` = bản sao schema hiện tại, ví dụ `turso db shell pfc-opportunity .dump` nạp vào một file SQLite). Kiểm tra file SQL, rồi chạy `npm run db:turso:migrate` trước khi deploy code mới.

## 10. Cập nhật về sau

Đẩy code lên nhánh chính → Vercel tự deploy. CI (`.github/workflows/pfc-app.yml`) chạy typecheck, test và build cho mọi thay đổi trong `PFC-App/`. Migration mới tự chạy ở request đầu tiên sau deploy — tạo bản sao Turso trước (mục 2).

## 11. Sao lưu & khôi phục

- **Turso** tự giữ bản khôi phục theo thời điểm (point-in-time) trong thời hạn của gói đang dùng. Khôi phục: `turso db create pfc-restore --from-db pfc --timestamp 2026-11-20T10:00:00Z`, kiểm tra dữ liệu, rồi trỏ `PFC_DB_URL` / `PFC_DB_AUTH_TOKEN` sang database mới và Redeploy.
- **Trước mỗi lần deploy có migration mới**, tạo bản sao: `turso db create pfc-backup-$(date +%Y%m%d) --from-db pfc`.
- **Ảnh tải lên** nằm ở Vercel Blob, không bị ảnh hưởng khi khôi phục database (ảnh mồ côi không gây lỗi).
- Bảng điều khiển **Quản trị** (`/admin`) hiện tình trạng database và cấu hình; `/api/health` cho kết quả dạng JSON để gắn công cụ giám sát.

## 12. Cấu hình sau khi chạy thật (Quản trị → Cấu hình, chỉ Chủ nhiệm)

- **Bật / tắt tính năng:** Cộng đồng, Tin nhắn, Sự kiện, Ngon – Bổ – Rẻ, Tìm cộng sự, Điểm thưởng — tắt là ẩn ngay cho mọi người, dữ liệu giữ nguyên.
- **Điểm thưởng & hạng:** app có sẵn mức điểm và mốc hạng *đề xuất* (trang Cấu hình có dòng nhắc vàng tới khi bấm Lưu). PFC cần chốt lại trước khi công bố.
- **Quà tặng:** Quản trị → Quà tặng & đổi điểm. Chỉ thêm quà / đối tác đã thỏa thuận thật.

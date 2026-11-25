/**
 * Production configuration check (G0). Pure: takes the env object so it is unit tested.
 * Problems block a safe launch; warnings are features that stay switched off.
 * Only variable NAMES are ever reported, never values.
 */
export type EnvReport = { problems: string[]; warnings: string[] };

type Env = Record<string, string | undefined>;

export function checkEnv(env: Env, production: boolean): EnvReport {
  const problems: string[] = [];
  const warnings: string[] = [];
  const need = (name: string, why: string) => {
    if (!env[name]?.trim()) problems.push(`${name}: ${why}`);
  };

  const secret = env.PFC_SESSION_SECRET ?? "";
  if (secret.length < 32) problems.push("PFC_SESSION_SECRET: cần chuỗi ngẫu nhiên ≥ 32 ký tự (ký phiên đăng nhập).");
  for (const s of ["CLUB_SSO_SECRET", "OPP_SSO_SECRET"]) {
    if ((env[s] ?? "").length < 32) (production ? problems : warnings).push(`${s}: cần ≥ 32 ký tự, trùng với secret bên service tương ứng.`);
    else if (env[s] === secret) problems.push(`${s}: không được trùng PFC_SESSION_SECRET.`);
  }

  if (!!env.VNPAY_TMN_CODE?.trim() !== !!env.VNPAY_HASH_SECRET?.trim()) problems.push("VNPAY_TMN_CODE / VNPAY_HASH_SECRET: đặt cả hai hoặc bỏ trống cả hai.");
  const fee = env.PFC_PLATFORM_FEE_BPS?.trim();
  if (fee && !(/^\d+$/.test(fee) && Number(fee) <= 3000)) problems.push("PFC_PLATFORM_FEE_BPS: số nguyên 0–3000 (100 = 1%).");
  const cron = env.CRON_SECRET ?? "";
  if (cron && cron.length < 16) problems.push("CRON_SECRET: cần ≥ 16 ký tự.");

  const enc = env.PFC_ENCRYPTION_KEY ?? "";
  if (enc && enc.length < 32) problems.push("PFC_ENCRYPTION_KEY: cần ≥ 32 ký tự (mã hóa khóa xác thực hai lớp).");
  else if (enc && enc === secret) problems.push("PFC_ENCRYPTION_KEY: không được trùng PFC_SESSION_SECRET.");

  if (!production) return { problems, warnings };
  if (!enc) problems.push("PFC_ENCRYPTION_KEY: cần chuỗi ngẫu nhiên ≥ 32 ký tự riêng, để đổi PFC_SESSION_SECRET không làm hỏng xác thực hai lớp.");

  const dbUrl = env.PFC_DB_URL ?? "";
  if (!dbUrl || dbUrl.startsWith("file:")) problems.push("PFC_DB_URL: production phải là Turso (libsql://…). File SQLite trên Vercel sẽ mất dữ liệu.");
  else if (dbUrl.startsWith("libsql://")) need("PFC_DB_AUTH_TOKEN", "token Turso cho PFC_DB_URL.");

  const pub = env.PFC_PUBLIC_URL ?? "";
  if (!pub.startsWith("https://")) problems.push("PFC_PUBLIC_URL: địa chỉ https công khai của app (dùng trong email và OAuth).");

  for (const o of ["CLUB_API_ORIGIN", "OPP_API_ORIGIN"]) {
    const v = env[o] ?? "";
    if (!v.startsWith("https://")) problems.push(`${o}: địa chỉ https của service (Câu lạc bộ / Cơ hội).`);
  }

  if (env.PFC_MAIL_MODE !== "resend") problems.push("PFC_MAIL_MODE: đặt \"resend\" để gửi email xác thực / quên mật khẩu.");
  else {
    need("RESEND_API_KEY", "khóa Resend.");
    need("PFC_MAIL_FROM", "địa chỉ gửi, ví dụ PFC <no-reply@ten-mien>.");
  }

  if (env.PFC_STORAGE !== "blob") problems.push("PFC_STORAGE: đặt \"blob\" (Vercel Blob) để lưu ảnh tải lên; ổ đĩa Vercel không lưu lâu dài.");
  else need("BLOB_READ_WRITE_TOKEN", "token Vercel Blob.");

  if (env.PFC_INSECURE_COOKIES === "1") problems.push("PFC_INSECURE_COOKIES: không được bật trên production.");
  if (!env.PFC_OWNER_EMAILS?.trim()) warnings.push("PFC_OWNER_EMAILS: chưa có email Chủ nhiệm đầu tiên.");
  if (!cron) warnings.push("CRON_SECRET: chưa đặt — việc định kỳ (hết hạn thanh toán, nhắc lịch sự kiện) không chạy.");
  if (!env.VNPAY_TMN_CODE) warnings.push("Thanh toán trực tuyến VNPAY đang tắt (VNPAY_TMN_CODE / VNPAY_HASH_SECRET).");
  else if (!env.VNPAY_PAY_URL) warnings.push("VNPAY đang dùng môi trường sandbox (VNPAY_PAY_URL trống): không thu tiền thật.");
  if (!env.GOOGLE_CLIENT_ID || !env.GOOGLE_CLIENT_SECRET) warnings.push("Đăng nhập Google đang tắt (GOOGLE_CLIENT_ID / GOOGLE_CLIENT_SECRET).");
  if (!env.FACEBOOK_APP_ID || !env.FACEBOOK_APP_SECRET) warnings.push("Đăng nhập Facebook đang tắt (FACEBOOK_APP_ID / FACEBOOK_APP_SECRET).");
  return { problems, warnings };
}

import "server-only";
import { rewardReferral } from "@/modules/rewards/server/service";
import bcrypt from "bcryptjs";
import { randomUUID } from "node:crypto";
import { z } from "zod";
import { all, one, run } from "@/platform/db/client";
import { audit } from "@/platform/audit";
import { ActionError } from "@/platform/errors";
import { publicUrl, sendMail } from "@/platform/mail";
import { allowAttempt, checkLimit, clearLimit, recordFailure } from "@/platform/rate-limit";
import type { Actor } from "@/platform/roles";
import { hashOneTimeToken, newOneTimeToken, PROVIDERS, type Provider } from "@/platform/auth/oauth";
import { hashBackupCode, newBackupCodes, newTotpSecret, otpauthUrl, seal, unseal, verifyTotp } from "@/platform/auth/totp";
import { notify } from "@/platform/notifications/service";
import { verifyOwnUploadUrls } from "@/platform/uploads/service";
import { INTERESTS, LOCALES, PRIVACY_DEFAULTS, type Interest, type Locale, type Privacy } from "./options";

/** Account self-service (G1: SYS-12/13/14/15, MEM-01…09, mockups 265–275). All checks server-side. */
const now = () => new Date().toISOString();
const emailSchema = z.string().trim().toLowerCase().email("Email không hợp lệ.").max(254);
const hasPassword = (h: string) => h.startsWith("$2");

function encKey(): string {
  const k = process.env.PFC_ENCRYPTION_KEY || process.env.PFC_SESSION_SECRET || "";
  if (k.length < 32) throw new ActionError("Máy chủ chưa cấu hình khóa mã hóa (PFC_ENCRYPTION_KEY).");
  return k;
}

// ───────────────────────── Profile ─────────────────────────

export type Profile = {
  id: string;
  email: string;
  fullName: string;
  phone: string | null;
  birthDate: string | null;
  gender: "female" | "male" | "other" | null;
  address: string | null;
  bio: string;
  avatarUrl: string | null;
  interests: Interest[];
  locale: Locale;
  privacy: Privacy;
  emailVerified: boolean;
  hasPassword: boolean;
  createdAt: string;
};

type MemberRow = {
  id: string;
  email: string;
  full_name: string;
  phone: string | null;
  birth_date: string | null;
  gender: string | null;
  address: string | null;
  bio: string;
  avatar_url: string | null;
  interests: string;
  locale: string;
  privacy: string;
  email_verified_at: string | null;
  password_hash: string;
  created_at: string;
};

const parse = <T,>(raw: string, fallback: T): T => {
  try {
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
};

export async function getProfile(memberId: string): Promise<Profile> {
  const r = await one<MemberRow>("SELECT * FROM members WHERE id = ? AND deleted_at IS NULL", [memberId]);
  if (!r) throw new ActionError("Không tìm thấy tài khoản.");
  return {
    id: r.id,
    email: r.email,
    fullName: r.full_name,
    phone: r.phone,
    birthDate: r.birth_date,
    gender: r.gender === "female" || r.gender === "male" || r.gender === "other" ? r.gender : null,
    address: r.address,
    bio: r.bio ?? "",
    avatarUrl: r.avatar_url,
    interests: parse<string[]>(r.interests, []).filter((x): x is Interest => x in INTERESTS),
    locale: (LOCALES as readonly string[]).includes(r.locale) ? (r.locale as Locale) : "vi",
    privacy: { ...PRIVACY_DEFAULTS, ...parse<Partial<Privacy>>(r.privacy, {}) },
    emailVerified: !!r.email_verified_at,
    hasPassword: hasPassword(r.password_hash),
    createdAt: r.created_at,
  };
}

const today = () => new Date().toISOString().slice(0, 10);
const profileSchema = z.object({
  fullName: z.string().trim().min(2, "Vui lòng nhập họ và tên.").max(80),
  phone: z
    .string()
    .trim()
    .transform((v) => v.replace(/[\s.-]/g, ""))
    .refine((v) => v === "" || /^(\+84|0)\d{9,10}$/.test(v), "Số điện thoại không hợp lệ.")
    .default(""),
  birthDate: z
    .string()
    .trim()
    .refine((v) => v === "" || (/^\d{4}-\d{2}-\d{2}$/.test(v) && v >= "1900-01-01" && v <= today()), "Ngày sinh không hợp lệ.")
    .default(""),
  gender: z.enum(["female", "male", "other", ""]).default(""),
  address: z.string().trim().max(200).default(""),
  bio: z.string().trim().max(500, "Giới thiệu tối đa 500 ký tự.").default(""),
});

/** SYS-13 / mockup 266. Email is changed separately (needs verification). */
export async function updateProfile(actor: Actor, input: unknown): Promise<void> {
  const d = profileSchema.parse(input);
  await run("UPDATE members SET full_name = ?, phone = ?, birth_date = ?, gender = ?, address = ?, bio = ?, updated_at = ? WHERE id = ?", [
    d.fullName,
    d.phone || null,
    d.birthDate || null,
    d.gender || null,
    d.address || null,
    d.bio,
    now(),
    actor.id,
  ]);
}

/** Avatar: only an image the member uploaded as "avatar" (already square-cropped, metadata stripped). */
export async function setAvatar(actor: Actor, url: string | null): Promise<void> {
  const [ok] = url ? await verifyOwnUploadUrls(actor, "avatar", [url], 1) : [null];
  await run("UPDATE members SET avatar_url = ?, updated_at = ? WHERE id = ?", [ok ?? null, now(), actor.id]);
}

// ───────────────────────── Email change ─────────────────────────

async function reauth(memberId: string, password: unknown): Promise<void> {
  const r = await one<{ password_hash: string }>("SELECT password_hash FROM members WHERE id = ?", [memberId]);
  if (!r) throw new ActionError("Không tìm thấy tài khoản.");
  if (!hasPassword(r.password_hash)) return; // social-only account: no password to ask for
  const key = `reauth:${memberId}`;
  const limit = await checkLimit(key, 5);
  if (!limit.ok) throw new ActionError(`Bạn nhập sai quá nhiều lần. Vui lòng thử lại sau ${Math.ceil(limit.retryAfterSec / 60)} phút.`, "rate_limited");
  if (typeof password !== "string" || !(await bcrypt.compare(password, r.password_hash))) {
    await recordFailure(key, 15 * 60_000);
    throw new ActionError("Mật khẩu không đúng.", "bad_password");
  }
  await clearLimit(key);
}

/** Sends a confirmation link to the NEW address; the email only changes after it is clicked. */
export async function requestEmailChange(actor: Actor, input: unknown): Promise<void> {
  const d = z.object({ email: emailSchema, password: z.string().optional() }).parse(input);
  await reauth(actor.id, d.password);
  if (!(await allowAttempt(`email-change:${actor.id}`, 3, 60 * 60_000))) throw new ActionError("Bạn đã yêu cầu quá nhiều lần. Thử lại sau 1 giờ.", "rate_limited");
  const me = await one<{ email: string; full_name: string }>("SELECT email, full_name FROM members WHERE id = ?", [actor.id]);
  if (me?.email === d.email) throw new ActionError("Đây đã là email hiện tại của bạn.");
  if (await one("SELECT id FROM members WHERE email = ?", [d.email])) throw new ActionError("Email này đã được dùng cho tài khoản khác.");
  await run("UPDATE auth_tokens SET used_at = ? WHERE member_id = ? AND purpose = 'email_change' AND used_at IS NULL", [now(), actor.id]);
  const { token, hash } = newOneTimeToken();
  await run("INSERT INTO auth_tokens (token_hash, member_id, purpose, expires_at, created_at, payload) VALUES (?, ?, 'email_change', ?, ?, ?)", [
    hash,
    actor.id,
    new Date(Date.now() + 60 * 60_000).toISOString(),
    now(),
    d.email,
  ]);
  await sendMail({
    to: d.email,
    subject: "PFC · Xác nhận email mới",
    text: `Chào ${me?.full_name ?? "bạn"},\n\nBấm liên kết sau để dùng địa chỉ này cho tài khoản PFC (hiệu lực 1 giờ):\n${publicUrl()}/verify-email/change?token=${token}\n\nNếu bạn không yêu cầu, hãy bỏ qua thư này.`,
  });
  if (me) {
    await sendMail({
      to: me.email,
      subject: "PFC · Có yêu cầu đổi email tài khoản",
      text: `Tài khoản PFC của bạn vừa yêu cầu đổi email sang một địa chỉ khác. Nếu không phải bạn, hãy đổi mật khẩu ngay và liên hệ Chủ nhiệm PFC.`,
    });
  }
  await audit(actor.id, "member.email_change_request", `member:${actor.id}`, "success");
}

export async function confirmEmailChange(token: unknown): Promise<void> {
  if (typeof token !== "string" || token.length < 20) throw new ActionError("Liên kết không hợp lệ.", "invalid");
  const r = await one<{ member_id: string; payload: string | null; expires_at: string; used_at: string | null }>(
    "SELECT member_id, payload, expires_at, used_at FROM auth_tokens WHERE token_hash = ? AND purpose = 'email_change'",
    [hashOneTimeToken(token)],
  );
  if (!r || !r.payload) throw new ActionError("Liên kết không hợp lệ.", "invalid");
  if (r.used_at) throw new ActionError("Liên kết đã được sử dụng.", "used");
  if (r.expires_at <= now()) throw new ActionError("Liên kết đã hết hạn. Hãy yêu cầu lại.", "expired");
  if (await one("SELECT id FROM members WHERE email = ? AND id != ?", [r.payload, r.member_id])) throw new ActionError("Email này đã được dùng cho tài khoản khác.");
  const used = await run("UPDATE auth_tokens SET used_at = ? WHERE token_hash = ? AND used_at IS NULL", [now(), hashOneTimeToken(token)]);
  if (used !== 1) throw new ActionError("Liên kết đã được sử dụng.", "used");
  await run("UPDATE members SET email = ?, email_verified_at = ?, updated_at = ? WHERE id = ?", [r.payload, now(), now(), r.member_id]);
  await audit(r.member_id, "member.email_change", `member:${r.member_id}`, "success");
  await notify(r.member_id, { category: "account", title: "Email đăng nhập đã được đổi", body: `Email mới: ${r.payload}`, href: "/more/account/profile" });
}

// ───────────────────────── Onboarding, language, privacy, consents ─────────────────────────

/** SYS-07 (mockup 7): interests drive the order of branches on Home. */
export async function completeOnboarding(actor: Actor, interests: unknown): Promise<void> {
  const list = z.array(z.string()).max(10).parse(interests ?? []).filter((x): x is Interest => x in INTERESTS);
  await run("UPDATE members SET interests = ?, onboarded_at = COALESCE(onboarded_at, ?), updated_at = ? WHERE id = ?", [JSON.stringify([...new Set(list)]), now(), now(), actor.id]);
  await rewardReferral(actor.id);
}

export async function setLocale(actor: Actor, locale: unknown): Promise<void> {
  const l = z.enum(LOCALES).parse(locale);
  await run("UPDATE members SET locale = ?, updated_at = ? WHERE id = ?", [l, now(), actor.id]);
}

const privacySchema = z.object({
  profileVisibility: z.enum(["members", "private"]),
  findByEmail: z.boolean(),
  messages: z.enum(["members", "following", "none"]).default("members"),
});

/** Mockup 272. Every option here is enforced (search, project invites). */
export async function setPrivacy(actor: Actor, input: unknown): Promise<void> {
  const p = privacySchema.parse(input);
  await run("UPDATE members SET privacy = ?, updated_at = ? WHERE id = ?", [JSON.stringify(p), now(), actor.id]);
  await recordConsent(actor.id, "privacy_settings", true, JSON.stringify(p));
}

export async function recordConsent(memberId: string, kind: string, granted: boolean, version: string | null = null): Promise<void> {
  await run("INSERT INTO member_consents (id, member_id, kind, granted, version, created_at) VALUES (?, ?, ?, ?, ?, ?)", [randomUUID(), memberId, kind, granted ? 1 : 0, version, now()]);
}

export async function consentHistory(memberId: string): Promise<{ kind: string; granted: boolean; version: string | null; createdAt: string }[]> {
  return (
    await all<{ kind: string; granted: number; version: string | null; created_at: string }>(
      "SELECT kind, granted, version, created_at FROM member_consents WHERE member_id = ? ORDER BY created_at DESC LIMIT 100",
      [memberId],
    )
  ).map((r) => ({ kind: r.kind, granted: !!r.granted, version: r.version, createdAt: r.created_at }));
}

// ───────────────────────── Linked accounts (mockup 273) ─────────────────────────

export async function linkedAccounts(memberId: string): Promise<{ provider: Provider; email: string | null; linkedAt: string }[]> {
  return (
    await all<{ provider: Provider; email: string | null; created_at: string }>("SELECT provider, email, created_at FROM member_identities WHERE member_id = ? ORDER BY created_at", [memberId])
  ).filter((r) => (PROVIDERS as readonly string[]).includes(r.provider)).map((r) => ({ provider: r.provider, email: r.email, linkedAt: r.created_at }));
}

/** Links a verified social identity to the signed-in member (called from the OAuth callback). */
export async function linkIdentity(memberId: string, p: { provider: Provider; subject: string; email: string | null }): Promise<void> {
  const used = await one<{ member_id: string }>("SELECT member_id FROM member_identities WHERE provider = ? AND subject = ?", [p.provider, p.subject]);
  if (used && used.member_id !== memberId) throw new ActionError("Tài khoản mạng xã hội này đã liên kết với một tài khoản PFC khác.", "identity_taken");
  if (used) return;
  if (await one("SELECT 1 AS x FROM member_identities WHERE member_id = ? AND provider = ?", [memberId, p.provider])) {
    throw new ActionError("Bạn đã liên kết một tài khoản khác của nhà cung cấp này. Hủy liên kết trước.", "already_linked");
  }
  await run("INSERT INTO member_identities (provider, subject, member_id, email, created_at) VALUES (?, ?, ?, ?, ?)", [p.provider, p.subject, memberId, p.email, now()]);
  await audit(memberId, "member.link_identity", `member:${memberId}/${p.provider}`, "success");
}

/** Never leaves the member without a way to sign in. */
export async function unlinkIdentity(actor: Actor, provider: unknown): Promise<void> {
  const p = z.enum(PROVIDERS).parse(provider);
  const r = await one<{ password_hash: string }>("SELECT password_hash FROM members WHERE id = ?", [actor.id]);
  const ids = await all<{ provider: string }>("SELECT provider FROM member_identities WHERE member_id = ?", [actor.id]);
  if (!ids.some((i) => i.provider === p)) throw new ActionError("Chưa liên kết tài khoản này.");
  if (!hasPassword(r?.password_hash ?? "") && ids.length <= 1) {
    throw new ActionError("Đây là cách đăng nhập duy nhất của bạn. Hãy tạo mật khẩu (Quên mật khẩu?) trước khi hủy liên kết.", "last_method");
  }
  await run("DELETE FROM member_identities WHERE member_id = ? AND provider = ?", [actor.id, p]);
  await audit(actor.id, "member.unlink_identity", `member:${actor.id}/${p}`, "success");
}

// ───────────────────────── Two-step login (mockup 268) ─────────────────────────

export async function twoFactorStatus(memberId: string): Promise<{ enabled: boolean; backupLeft: number }> {
  const r = await one<{ enabled_at: string | null; backup_codes: string }>("SELECT enabled_at, backup_codes FROM member_totp WHERE member_id = ?", [memberId]);
  return { enabled: !!r?.enabled_at, backupLeft: r ? parse<string[]>(r.backup_codes, []).length : 0 };
}

/** Step 1: new secret (not active yet) → QR for the authenticator app. */
export async function startTwoFactor(actor: Actor & { email?: string }): Promise<{ secret: string; otpauth: string }> {
  if ((await twoFactorStatus(actor.id)).enabled) throw new ActionError("Xác thực hai lớp đã bật.");
  const email = (await one<{ email: string }>("SELECT email FROM members WHERE id = ?", [actor.id]))?.email ?? "";
  const secret = newTotpSecret();
  await run(
    `INSERT INTO member_totp (member_id, secret_enc, enabled_at, backup_codes, last_step, created_at) VALUES (?, ?, NULL, '[]', 0, ?)
     ON CONFLICT (member_id) DO UPDATE SET secret_enc = excluded.secret_enc, enabled_at = NULL, backup_codes = '[]', last_step = 0, created_at = excluded.created_at`,
    [actor.id, seal(secret, encKey()), now()],
  );
  return { secret, otpauth: otpauthUrl(secret, email) };
}

/** Step 2: the first valid code turns it on and returns backup codes (shown once). */
export async function confirmTwoFactor(actor: Actor, code: unknown): Promise<string[]> {
  const r = await one<{ secret_enc: string; enabled_at: string | null }>("SELECT secret_enc, enabled_at FROM member_totp WHERE member_id = ?", [actor.id]);
  if (!r) throw new ActionError("Hãy bắt đầu lại bước quét mã QR.");
  if (r.enabled_at) throw new ActionError("Xác thực hai lớp đã bật.");
  if (!(await allowAttempt(`2fa-setup:${actor.id}`, 10, 15 * 60_000))) throw new ActionError("Bạn nhập sai quá nhiều lần. Thử lại sau 15 phút.", "rate_limited");
  const step = verifyTotp(unseal(r.secret_enc, encKey()), String(code ?? ""), Date.now());
  if (step === null) throw new ActionError("Mã không đúng. Kiểm tra giờ trên điện thoại và nhập mã mới nhất.", "bad_code");
  const codes = newBackupCodes();
  await run("UPDATE member_totp SET enabled_at = ?, last_step = ?, backup_codes = ? WHERE member_id = ?", [now(), step, JSON.stringify(codes.map(hashBackupCode)), actor.id]);
  await audit(actor.id, "member.2fa_enable", `member:${actor.id}`, "success");
  await notify(actor.id, { category: "account", title: "Đã bật xác thực hai lớp", href: "/more/account/2fa" });
  return codes;
}

/**
 * Checks a 6-digit code or a backup code for sign-in / sensitive actions.
 * TOTP steps cannot be replayed; backup codes are single use. 5 tries / 15 minutes.
 */
export async function verifySecondFactor(memberId: string, code: unknown): Promise<boolean> {
  const r = await one<{ secret_enc: string; enabled_at: string | null; backup_codes: string; last_step: number }>(
    "SELECT secret_enc, enabled_at, backup_codes, last_step FROM member_totp WHERE member_id = ?",
    [memberId],
  );
  if (!r?.enabled_at) return true;
  // Failure-only limiter: wrong codes count, successful sign-ins do not.
  const key = `2fa:${memberId}`;
  const limit = await checkLimit(key, 5);
  if (!limit.ok) throw new ActionError(`Bạn nhập sai quá nhiều lần. Thử lại sau ${Math.ceil(limit.retryAfterSec / 60)} phút.`, "rate_limited");
  const fail = async () => {
    await recordFailure(key, 15 * 60_000);
    await audit(memberId, "member.2fa_verify", `member:${memberId}`, "failure");
    return false;
  };
  const c = String(code ?? "").trim();
  if (/^\d{3}\s?\d{3}$/.test(c)) {
    const step = verifyTotp(unseal(r.secret_enc, encKey()), c, Date.now(), Number(r.last_step));
    if (step === null) return fail();
    const n = await run("UPDATE member_totp SET last_step = ? WHERE member_id = ? AND last_step < ?", [step, memberId, step]);
    if (n !== 1) return fail();
    await clearLimit(key);
    return true;
  }
  const h = hashBackupCode(c);
  const left = parse<string[]>(r.backup_codes, []);
  if (!left.includes(h)) return fail();
  await run("UPDATE member_totp SET backup_codes = ? WHERE member_id = ?", [JSON.stringify(left.filter((x) => x !== h)), memberId]);
  await clearLimit(key);
  await audit(memberId, "member.2fa_backup_code", `member:${memberId}`, "success");
  return true;
}

export async function disableTwoFactor(actor: Actor, input: unknown): Promise<void> {
  const d = z.object({ password: z.string().optional(), code: z.string() }).parse(input);
  await reauth(actor.id, d.password);
  if (!(await verifySecondFactor(actor.id, d.code))) throw new ActionError("Mã xác thực không đúng.", "bad_code");
  await run("DELETE FROM member_totp WHERE member_id = ?", [actor.id]);
  await audit(actor.id, "member.2fa_disable", `member:${actor.id}`, "success");
  await notify(actor.id, { category: "account", title: "Đã tắt xác thực hai lớp", body: "Không phải bạn? Đổi mật khẩu ngay.", href: "/more/account/2fa" });
}

// ───────────────────────── Personal data (mockup 275, Nghị định 13/2023) ─────────────────────────

/** Tables holding the member's own data, by the column that points to them. */
const EXPORT_TABLES: [string, string][] = [
  ["fin_categories", "member_id"],
  ["fin_transactions", "member_id"],
  ["fin_budgets", "member_id"],
  ["fin_goals", "member_id"],
  ["fin_challenges", "member_id"],
  ["edu_courses", "author_id"],
  ["edu_quizzes", "author_id"],
  ["edu_resources", "author_id"],
  ["edu_enrollments", "member_id"],
  ["edu_lesson_progress", "member_id"],
  ["edu_attempts", "member_id"],
  ["edu_threads", "author_id"],
  ["edu_replies", "author_id"],
  ["mkt_sellers", "member_id"],
  ["mkt_listings", "seller_id"],
  ["mkt_cart_items", "member_id"],
  ["mkt_favorites", "member_id"],
  ["mkt_orders", "buyer_id"],
  ["mkt_reviews", "buyer_id"],
  ["prj_projects", "owner_id"],
  ["prj_members", "member_id"],
  ["prj_tasks", "created_by"],
  ["prj_updates", "author_id"],
  ["prj_feedback", "author_id"],
  ["uploads", "owner_id"],
  ["member_consents", "member_id"],
  ["notifications", "member_id"],
  ["notification_prefs", "member_id"],
];

/** "Tải xuống dữ liệu": everything PFC App stores about the member, as JSON. Secrets and hashes excluded. */
export async function exportMyData(actor: Actor): Promise<Record<string, unknown>> {
  if (!(await allowAttempt(`export:${actor.id}`, 5, 60 * 60_000))) throw new ActionError("Bạn đã tải quá nhiều lần. Thử lại sau 1 giờ.", "rate_limited");
  const profile = await getProfile(actor.id);
  const out: Record<string, unknown> = {
    exportedAt: now(),
    note: "Dữ liệu PFC App. Dữ liệu ở Câu lạc bộ và Cơ hội được lưu ở service riêng; xuất trong từng nhánh.",
    profile,
    linkedAccounts: await linkedAccounts(actor.id),
    sessions: await all("SELECT device, ip_hint, created_at, last_seen_at, revoked_at FROM member_sessions WHERE member_id = ?", [actor.id]),
    twoFactorEnabled: (await twoFactorStatus(actor.id)).enabled,
  };
  for (const [table, col] of EXPORT_TABLES) out[table] = await all(`SELECT * FROM ${table} WHERE ${col} = ?`, [actor.id]);
  out.mkt_orders_as_seller = await all("SELECT * FROM mkt_orders WHERE seller_id = ?", [actor.id]);
  await audit(actor.id, "member.export_data", `member:${actor.id}`, "success");
  return out;
}

/**
 * "Xóa dữ liệu / Xóa tài khoản". Personal data is deleted; records other members depend on (orders,
 * reviews, forum replies, project history) stay but show "Tài khoản đã xóa". Irreversible.
 */
export async function deleteAccount(actor: Actor, input: unknown): Promise<void> {
  const d = z.object({ password: z.string().optional(), confirm: z.string() }).parse(input);
  const me = await one<{ email: string; role: string }>("SELECT email, role FROM members WHERE id = ? AND deleted_at IS NULL", [actor.id]);
  if (!me) throw new ActionError("Không tìm thấy tài khoản.");
  if (d.confirm.trim().toLowerCase() !== me.email) throw new ActionError("Nhập đúng email của bạn để xác nhận.", "bad_confirm");
  await reauth(actor.id, d.password);
  if (me.role === "chu_nhiem") {
    const owners = await one<{ n: number }>("SELECT COUNT(*) AS n FROM members WHERE role = 'chu_nhiem' AND deleted_at IS NULL AND locked = 0");
    if (Number(owners?.n ?? 0) <= 1) throw new ActionError("Bạn là Chủ nhiệm duy nhất. Hãy chuyển quyền Chủ nhiệm cho người khác trước.", "last_owner");
  }
  const open = await one<{ n: number }>(
    "SELECT COUNT(*) AS n FROM mkt_orders WHERE (buyer_id = ? OR seller_id = ?) AND status IN ('placed','confirmed','shipping','delivered')",
    [actor.id, actor.id],
  );
  if (Number(open?.n ?? 0) > 0) throw new ActionError(`Bạn còn ${open!.n} đơn hàng chưa hoàn tất. Hãy hoàn tất hoặc hủy trước khi xóa tài khoản.`, "open_orders");
  const owned = await one<{ n: number }>("SELECT COUNT(*) AS n FROM prj_projects WHERE owner_id = ? AND status IN ('submitted','active')", [actor.id]);
  if (Number(owned?.n ?? 0) > 0) throw new ActionError(`Bạn đang là chủ ${owned!.n} dự án đang hoạt động. Hãy hoàn thành hoặc lưu trữ trước.`, "open_projects");

  const t = now();
  for (const table of ["fin_transactions", "fin_budgets", "fin_goals", "fin_challenges", "fin_categories", "mkt_cart_items", "mkt_favorites", "edu_enrollments", "edu_lesson_progress", "edu_attempts", "edu_thread_likes", "prj_views", "notifications", "notification_prefs", "push_subscriptions", "member_identities", "member_totp", "auth_tokens", "member_sessions"]) {
    await run(`DELETE FROM ${table} WHERE member_id = ?`, [actor.id]);
  }
  await run("UPDATE prj_members SET status = 'left', updated_at = ? WHERE member_id = ? AND status IN ('active','invited','requested')", [t, actor.id]);
  await run("UPDATE prj_tasks SET assignee_id = NULL WHERE assignee_id = ?", [actor.id]);
  await run("UPDATE mkt_listings SET status = 'archived', updated_at = ? WHERE seller_id = ? AND status != 'archived'", [t, actor.id]);
  await run("UPDATE mkt_sellers SET status = 'suspended', shop_name = 'Cửa hàng đã đóng', bio = '', contact = '', updated_at = ? WHERE member_id = ?", [t, actor.id]);
  await run(
    `UPDATE members SET email = ?, full_name = 'Tài khoản đã xóa', password_hash = '!', phone = NULL, birth_date = NULL, gender = NULL,
       address = NULL, bio = '', avatar_url = NULL, interests = '[]', privacy = '{}', role = 'thanh_vien', department = NULL,
       session_version = session_version + 1, deleted_at = ?, updated_at = ? WHERE id = ?`,
    [`deleted+${actor.id}@invalid.pfc`, t, t, actor.id],
  );
  await audit(actor.id, "member.delete_account", `member:${actor.id}`, "success");
}

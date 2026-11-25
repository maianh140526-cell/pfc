import "server-only";
import bcrypt from "bcryptjs";
import { randomUUID } from "node:crypto";
import { z } from "zod";
import { one, run } from "@/platform/db/client";
import { audit } from "@/platform/audit";
import { ActionError } from "@/platform/errors";
import { publicUrl, sendMail } from "@/platform/mail";
import { allowAttempt, checkLimit, clearLimit, recordFailure } from "@/platform/rate-limit";
import { hashOneTimeToken, newOneTimeToken, type SocialProfile } from "./oauth";
import { POLICY_VERSION } from "@/platform/account/policies";
import { notify } from "@/platform/notifications/service";
import { passwordSchema } from "./password-policy";

/** Consent record (Nghị định 13/2023): which terms version was accepted, and when. */
async function recordTermsConsent(memberId: string, how: string): Promise<void> {
  await run("INSERT INTO member_consents (id, member_id, kind, granted, version, created_at) VALUES (?, ?, 'terms', 1, ?, ?)", [randomUUID(), memberId, `${POLICY_VERSION}:${how}`, new Date().toISOString()]);
}

/**
 * Identity & Access use-cases (FR-CORE-001, UC-01, tasks 039–044). Every check happens here,
 * on the server. Error messages never reveal whether an email has an account.
 */
const now = () => new Date().toISOString();
const emailSchema = z.string().trim().toLowerCase().email("Email không hợp lệ.").max(254);
/** OAuth-only accounts have no usable password. */
const NO_PASSWORD = "!";
const hasPassword = (hash: string) => hash.startsWith("$2");

export const LOGIN_LIMIT = { perEmail: 5, perIp: 20, windowMs: 15 * 60_000 };
export const RESET_TTL_MS = 30 * 60_000;
export const VERIFY_TTL_MS = 24 * 60 * 60_000;

export const verificationRequired = () => process.env.PFC_REQUIRE_EMAIL_VERIFICATION === "1";

function ownerRole(email: string) {
  const owners = (process.env.PFC_OWNER_EMAILS ?? "").split(",").map((e) => e.trim().toLowerCase()).filter(Boolean);
  return owners.includes(email) ? "chu_nhiem" : "thanh_vien";
}

const minutes = (sec: number) => Math.max(1, Math.ceil(sec / 60));
function rateLimited(retryAfterSec: number): never {
  throw new ActionError(`Bạn đã thử quá nhiều lần. Vui lòng thử lại sau ${minutes(retryAfterSec)} phút.`, "rate_limited", { retryAfterSec });
}

// ───────────────────────── Login ─────────────────────────

const loginSchema = z.object({
  email: z.string().trim().min(1, "Vui lòng nhập email.").pipe(emailSchema),
  password: z.string().min(1, "Vui lòng nhập mật khẩu.").max(200),
});

type MemberRow = { id: string; password_hash: string; locked: number; email_verified_at: string | null };

/**
 * SYS-02 email + password. Order matters: rate limit → credentials → account state.
 * Locked / unverified are only revealed after a correct password, so they cannot be probed.
 */
export async function passwordLogin(input: unknown, ip: string): Promise<string> {
  const d = loginSchema.parse(input);
  const kEmail = `login:${d.email}`;
  const kIp = `login-ip:${ip}`;
  for (const [k, limit] of [
    [kEmail, LOGIN_LIMIT.perEmail],
    [kIp, LOGIN_LIMIT.perIp],
  ] as const) {
    const c = await checkLimit(k, limit);
    if (!c.ok) {
      await audit(null, "member.login", `email:${d.email}`, "failure");
      rateLimited(c.retryAfterSec);
    }
  }
  const row = await one<MemberRow>("SELECT id, password_hash, locked, email_verified_at FROM members WHERE email = ?", [d.email]);
  const ok = row && hasPassword(row.password_hash) ? await bcrypt.compare(d.password, row.password_hash) : false;
  if (!row || !ok) {
    const n = await recordFailure(kEmail, LOGIN_LIMIT.windowMs);
    await recordFailure(kIp, LOGIN_LIMIT.windowMs);
    await audit(row?.id ?? null, "member.login", `email:${d.email}`, "failure");
    const left = LOGIN_LIMIT.perEmail - n;
    if (left <= 0) rateLimited(LOGIN_LIMIT.windowMs / 1000);
    throw new ActionError(
      left <= 2 ? `Email hoặc mật khẩu không đúng. Còn ${left} lần thử trước khi bị tạm khóa 15 phút.` : "Email hoặc mật khẩu không đúng.",
      "invalid",
    );
  }
  if (Number(row.locked) === 1) {
    await audit(row.id, "member.login", `member:${row.id}`, "failure");
    throw new ActionError("Tài khoản đã bị khóa. Liên hệ Chủ nhiệm PFC để được hỗ trợ.", "locked");
  }
  if (!row.email_verified_at && verificationRequired()) {
    await audit(row.id, "member.login", `member:${row.id}`, "failure");
    throw new ActionError("Email chưa được xác thực. Mở thư xác thực PFC đã gửi, hoặc gửi lại thư.", "unverified", { email: d.email });
  }
  await clearLimit(kEmail);
  await audit(row.id, "member.login", `member:${row.id}`, "success");
  return row.id;
}

// ───────────────────────── Register ─────────────────────────

const registerSchema = z.object({
  fullName: z.string().trim().min(2, "Vui lòng nhập họ và tên.").max(80),
  email: z.string().trim().min(1, "Vui lòng nhập email.").pipe(emailSchema),
  password: passwordSchema,
  agree: z.literal(true, { errorMap: () => ({ message: "Bạn cần đồng ý Điều khoản và Chính sách bảo mật." }) }),
});

/** SYS-03. Returns whether the member must verify their email before signing in. */
export async function registerMember(input: unknown, ip: string): Promise<{ id: string; mustVerify: boolean }> {
  const d = registerSchema.parse(input);
  if (!(await allowAttempt(`register:${d.email}`, 5, 15 * 60_000)) || !(await allowAttempt(`register-ip:${ip}`, 20, 60 * 60_000))) {
    rateLimited(15 * 60);
  }
  if (await one("SELECT id FROM members WHERE email = ?", [d.email])) throw new ActionError("Email này đã được đăng ký. Hãy đăng nhập.", "exists");
  const id = randomUUID();
  const t = now();
  await run("INSERT INTO members (id, email, full_name, password_hash, role, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?)", [
    id,
    d.email,
    d.fullName,
    await bcrypt.hash(d.password, 12),
    ownerRole(d.email),
    t,
    t,
  ]);
  await audit(id, "member.register", `member:${id}`, "success");
  await recordTermsConsent(id, "register");
  await issueVerification(id, d.email, d.fullName);
  return { id, mustVerify: verificationRequired() };
}

// ───────────────────────── Email verification (SYS-06) ─────────────────────────

async function issueToken(memberId: string, purpose: "verify" | "reset", ttlMs: number): Promise<string> {
  // A new link invalidates older unused ones of the same purpose.
  await run("UPDATE auth_tokens SET used_at = ? WHERE member_id = ? AND purpose = ? AND used_at IS NULL", [now(), memberId, purpose]);
  const { token, hash } = newOneTimeToken();
  await run("INSERT INTO auth_tokens (token_hash, member_id, purpose, expires_at, created_at) VALUES (?, ?, ?, ?, ?)", [
    hash,
    memberId,
    purpose,
    new Date(Date.now() + ttlMs).toISOString(),
    now(),
  ]);
  return token;
}

async function issueVerification(memberId: string, email: string, name: string): Promise<void> {
  const token = await issueToken(memberId, "verify", VERIFY_TTL_MS);
  await sendMail({
    to: email,
    subject: "PFC · Xác thực email của bạn",
    text: `Chào ${name},\n\nBấm vào liên kết sau để xác thực email tài khoản PFC (hiệu lực 24 giờ):\n${publicUrl()}/verify-email?token=${token}\n\nNếu bạn không tạo tài khoản PFC, hãy bỏ qua thư này.`,
  });
}

/** "Gửi lại thư xác thực". Always succeeds from the caller's view (no account enumeration). */
export async function resendVerification(rawEmail: unknown, ip: string): Promise<void> {
  const email = emailSchema.parse(rawEmail);
  if (!(await allowAttempt(`verify-mail:${email}`, 3, 15 * 60_000)) || !(await allowAttempt(`verify-mail-ip:${ip}`, 10, 15 * 60_000))) rateLimited(15 * 60);
  const m = await one<{ id: string; full_name: string; email_verified_at: string | null; locked: number }>(
    "SELECT id, full_name, email_verified_at, locked FROM members WHERE email = ?",
    [email],
  );
  if (m && !m.email_verified_at && Number(m.locked) !== 1) await issueVerification(m.id, email, m.full_name);
}

type TokenCheck = { ok: true; memberId: string } | { ok: false; reason: "invalid" | "expired" | "used" };

async function checkToken(token: unknown, purpose: "verify" | "reset"): Promise<TokenCheck> {
  if (typeof token !== "string" || token.length < 20 || token.length > 200) return { ok: false, reason: "invalid" };
  const r = await one<{ member_id: string; expires_at: string; used_at: string | null }>(
    "SELECT member_id, expires_at, used_at FROM auth_tokens WHERE token_hash = ? AND purpose = ?",
    [hashOneTimeToken(token), purpose],
  );
  if (!r) return { ok: false, reason: "invalid" };
  if (r.used_at) return { ok: false, reason: "used" };
  if (r.expires_at <= now()) return { ok: false, reason: "expired" };
  return { ok: true, memberId: r.member_id };
}

/** Marks the token used; false if someone else used it first (single use). */
async function consumeToken(token: string, purpose: "verify" | "reset"): Promise<boolean> {
  const n = await run("UPDATE auth_tokens SET used_at = ? WHERE token_hash = ? AND purpose = ? AND used_at IS NULL AND expires_at > ?", [
    now(),
    hashOneTimeToken(token),
    purpose,
    now(),
  ]);
  return n === 1;
}

const TOKEN_MESSAGE = {
  invalid: "Liên kết không hợp lệ.",
  expired: "Liên kết đã hết hạn. Hãy yêu cầu liên kết mới.",
  used: "Liên kết đã được sử dụng. Hãy yêu cầu liên kết mới nếu cần.",
} as const;

export async function verifyEmail(token: unknown): Promise<void> {
  const c = await checkToken(token, "verify");
  if (!c.ok) throw new ActionError(TOKEN_MESSAGE[c.reason], c.reason);
  if (!(await consumeToken(token as string, "verify"))) throw new ActionError(TOKEN_MESSAGE.used, "used");
  await run("UPDATE members SET email_verified_at = COALESCE(email_verified_at, ?), updated_at = ? WHERE id = ?", [now(), now(), c.memberId]);
  await audit(c.memberId, "member.verify_email", `member:${c.memberId}`, "success");
}

// ───────────────────────── Forgot / reset password (SYS-04 / SYS-05) ─────────────────────────

/** Same response whether or not the email has an account. */
export async function requestPasswordReset(rawEmail: unknown, ip: string): Promise<void> {
  const email = z.string().trim().min(1, "Vui lòng nhập email.").pipe(emailSchema).parse(rawEmail);
  if (!(await allowAttempt(`reset:${email}`, 3, 60 * 60_000)) || !(await allowAttempt(`reset-ip:${ip}`, 10, 60 * 60_000))) rateLimited(60 * 60);
  const m = await one<{ id: string; full_name: string; locked: number }>("SELECT id, full_name, locked FROM members WHERE email = ?", [email]);
  if (!m || Number(m.locked) === 1) {
    await audit(m?.id ?? null, "member.reset_request", `email:${email}`, "failure");
    return;
  }
  const token = await issueToken(m.id, "reset", RESET_TTL_MS);
  await sendMail({
    to: email,
    subject: "PFC · Đặt lại mật khẩu",
    text: `Chào ${m.full_name},\n\nBấm vào liên kết sau để đặt mật khẩu mới (hiệu lực 30 phút, dùng một lần):\n${publicUrl()}/reset-password?token=${token}\n\nNếu bạn không yêu cầu, hãy bỏ qua thư này — mật khẩu hiện tại vẫn giữ nguyên.`,
  });
  await audit(m.id, "member.reset_request", `member:${m.id}`, "success");
}

export async function resetTokenStatus(token: unknown): Promise<"ok" | "invalid" | "expired" | "used"> {
  const c = await checkToken(token, "reset");
  return c.ok ? "ok" : c.reason;
}

const resetSchema = z
  .object({ token: z.string(), password: passwordSchema, confirm: z.string() })
  .refine((v) => v.password === v.confirm, { message: "Mật khẩu xác nhận không khớp." });

/** Sets the new password, signs out every device (session_version++), and confirms the email. */
export async function resetPassword(input: unknown): Promise<void> {
  const d = resetSchema.parse(input);
  const c = await checkToken(d.token, "reset");
  if (!c.ok) throw new ActionError(TOKEN_MESSAGE[c.reason], c.reason);
  if (!(await consumeToken(d.token, "reset"))) throw new ActionError(TOKEN_MESSAGE.used, "used");
  const t = now();
  await run(
    "UPDATE members SET password_hash = ?, session_version = session_version + 1, email_verified_at = COALESCE(email_verified_at, ?), updated_at = ? WHERE id = ?",
    [await bcrypt.hash(d.password, 12), t, t, c.memberId],
  );
  await run("UPDATE auth_tokens SET used_at = ? WHERE member_id = ? AND purpose = 'reset' AND used_at IS NULL", [t, c.memberId]);
  const email = await one<{ email: string }>("SELECT email FROM members WHERE id = ?", [c.memberId]);
  if (email) await clearLimit(`login:${email.email}`);
  await audit(c.memberId, "member.reset_password", `member:${c.memberId}`, "success");
  await notify(c.memberId, { category: "account", title: "Mật khẩu của bạn vừa được đặt lại", body: "Mọi thiết bị đã được đăng xuất. Không phải bạn? Liên hệ Chủ nhiệm PFC ngay.", href: "/more/account/devices" });
}

// ───────────────────────── Social sign-in ─────────────────────────

/**
 * Finds or creates the PFC member for a Google / Facebook identity.
 * - Known identity → that member.
 * - Unknown identity + email that already has an account: linked only when the provider
 *   verified the email (Google). Otherwise refused, so nobody can take over an account
 *   by registering that email at the provider.
 * - New email → new Thành viên account (no password; can set one via "Quên mật khẩu").
 */
export async function socialSignIn(p: SocialProfile): Promise<string> {
  const known = await one<{ member_id: string }>("SELECT member_id FROM member_identities WHERE provider = ? AND subject = ?", [p.provider, p.subject]);
  let memberId = known?.member_id ?? null;
  if (!memberId) {
    if (!p.email) throw new ActionError("Tài khoản mạng xã hội không cung cấp email. Hãy cho phép quyền email hoặc đăng nhập bằng email.", "no_email");
    const existing = await one<{ id: string }>("SELECT id FROM members WHERE email = ?", [p.email]);
    if (existing) {
      if (!p.emailVerified) {
        throw new ActionError("Email này đã có tài khoản PFC. Hãy đăng nhập bằng email và mật khẩu.", "email_conflict");
      }
      memberId = existing.id;
      await run("UPDATE members SET email_verified_at = COALESCE(email_verified_at, ?) WHERE id = ?", [now(), memberId]);
    } else {
      memberId = randomUUID();
      const t = now();
      await run(
        "INSERT INTO members (id, email, full_name, password_hash, role, email_verified_at, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
        [memberId, p.email, p.name, NO_PASSWORD, ownerRole(p.email), p.emailVerified ? t : null, t, t],
      );
      await audit(memberId, "member.register", `member:${memberId}/${p.provider}`, "success");
      await recordTermsConsent(memberId, p.provider);
    }
    await run("INSERT INTO member_identities (provider, subject, member_id, email, created_at) VALUES (?, ?, ?, ?, ?)", [p.provider, p.subject, memberId, p.email, now()]);
  }
  const m = await one<{ locked: number }>("SELECT locked FROM members WHERE id = ?", [memberId]);
  if (!m || Number(m.locked) === 1) {
    await audit(memberId, "member.login", `member:${memberId}/${p.provider}`, "failure");
    throw new ActionError("Tài khoản đã bị khóa. Liên hệ Chủ nhiệm PFC để được hỗ trợ.", "locked");
  }
  await audit(memberId, "member.login", `member:${memberId}/${p.provider}`, "success");
  return memberId;
}

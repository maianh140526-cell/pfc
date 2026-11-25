import { afterAll, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanupTempDbs, useTempDb } from "../../../test/db";

useTempDb();
const sent: { to: string; subject: string; text: string }[] = [];
vi.mock("@/platform/mail", () => ({
  publicUrl: () => "http://localhost:3200",
  sendMail: async (m: { to: string; subject: string; text: string }) => {
    sent.push(m);
    return true;
  },
}));
const auth = await import("./service");
const { one, run } = await import("@/platform/db/client");

const PW = "MatKhau123";
const linkToken = (text: string) => /token=([A-Za-z0-9_-]+)/.exec(text)?.[1] ?? "";
let n = 0;
const fresh = () => `user${++n}-${Date.now()}@pfc.test`;
async function register(email: string, ip = "1.1.1.1") {
  return auth.registerMember({ fullName: "Nguyễn Văn A", email, password: PW, agree: true }, ip);
}

beforeEach(() => {
  sent.length = 0;
  delete process.env.PFC_REQUIRE_EMAIL_VERIFICATION;
});
afterAll(cleanupTempDbs);

describe("register & login", () => {
  it("validates empty fields with clear messages", async () => {
    await expect(auth.passwordLogin({ email: "", password: "" }, "ip")).rejects.toThrow(/nhập email/);
    await expect(auth.passwordLogin({ email: "a@b.vn", password: "" }, "ip")).rejects.toThrow(/nhập mật khẩu/);
  });
  it("registers, sends a verification email, and logs in", async () => {
    const email = fresh();
    const r = await register(email);
    expect(r.mustVerify).toBe(false);
    expect(sent[0].to).toBe(email);
    expect(linkToken(sent[0].text).length).toBeGreaterThan(20);
    expect(await auth.passwordLogin({ email: email.toUpperCase(), password: PW }, "ip-a")).toBe(r.id);
    await expect(register(email)).rejects.toThrow(/đã được đăng ký/);
  });
  it("gives the same answer for unknown email and wrong password", async () => {
    const email = fresh();
    await register(email);
    const a = await auth.passwordLogin({ email, password: "sai-mat-khau1" }, "ip-b").catch((e) => e);
    const b = await auth.passwordLogin({ email: fresh(), password: "sai-mat-khau1" }, "ip-b").catch((e) => e);
    expect(a.code).toBe("invalid");
    expect(b.code).toBe("invalid");
    expect(a.message).toBe(b.message);
  });
  it("rate-limits after 5 failures, with a retry time, even for the right password", async () => {
    const email = fresh();
    await register(email);
    const errs = [];
    for (let i = 0; i < 5; i++) errs.push(await auth.passwordLogin({ email, password: "sai-mat-khau1" }, "ip-c").catch((e) => e));
    expect(errs[2].message).toMatch(/Còn 2 lần/);
    expect(errs[3].message).toMatch(/Còn 1 lần/);
    expect(errs[4].code).toBe("rate_limited");
    const blocked = await auth.passwordLogin({ email, password: PW }, "ip-c").catch((e) => e);
    expect(blocked.code).toBe("rate_limited");
    expect(blocked.meta.retryAfterSec).toBeGreaterThan(0);
  });
  it("reveals locked / unverified only after a correct password", async () => {
    const email = fresh();
    const { id } = await register(email);
    await run("UPDATE members SET locked = 1 WHERE id = ?", [id]);
    expect((await auth.passwordLogin({ email, password: "sai-mat-khau1" }, "ip-d").catch((e) => e)).code).toBe("invalid");
    expect((await auth.passwordLogin({ email, password: PW }, "ip-d").catch((e) => e)).code).toBe("locked");
    await run("UPDATE members SET locked = 0 WHERE id = ?", [id]);

    process.env.PFC_REQUIRE_EMAIL_VERIFICATION = "1";
    const e2 = fresh();
    const r2 = await register(e2);
    expect(r2.mustVerify).toBe(true);
    const token = linkToken(sent.at(-1)!.text);
    expect((await auth.passwordLogin({ email: e2, password: PW }, "ip-d").catch((e) => e)).code).toBe("unverified");
    await auth.verifyEmail(token);
    expect(await auth.passwordLogin({ email: e2, password: PW }, "ip-d")).toBe(r2.id);
    await expect(auth.verifyEmail(token)).rejects.toThrow(/đã được sử dụng/);
  });
  it("resending verification invalidates the old link and never reveals accounts", async () => {
    const email = fresh();
    await register(email);
    const first = linkToken(sent[0].text);
    await auth.resendVerification(email, "ip-e");
    await auth.resendVerification(fresh(), "ip-e"); // unknown: silent
    expect(sent).toHaveLength(2);
    await expect(auth.verifyEmail(first)).rejects.toThrow(/đã được sử dụng/);
    await auth.verifyEmail(linkToken(sent[1].text));
  });
});

describe("forgot / reset password", () => {
  it("sends a single-use link, sets the new password and revokes sessions", async () => {
    const email = fresh();
    const { id } = await register(email);
    sent.length = 0;
    await auth.requestPasswordReset(email, "ip-f");
    await auth.requestPasswordReset(fresh(), "ip-f"); // unknown email: no error, no mail
    expect(sent).toHaveLength(1);
    const token = linkToken(sent[0].text);
    expect(await auth.resetTokenStatus(token)).toBe("ok");
    expect(await auth.resetTokenStatus("x".repeat(43))).toBe("invalid");
    await expect(auth.resetPassword({ token, password: "MoiMoi123", confirm: "Khac123456" })).rejects.toThrow(/không khớp/);
    const before = await one<{ session_version: number }>("SELECT session_version FROM members WHERE id = ?", [id]);
    await auth.resetPassword({ token, password: "MoiMoi123", confirm: "MoiMoi123" });
    const after = await one<{ session_version: number }>("SELECT session_version FROM members WHERE id = ?", [id]);
    expect(Number(after!.session_version)).toBe(Number(before!.session_version) + 1);
    expect(await auth.resetTokenStatus(token)).toBe("used");
    await expect(auth.passwordLogin({ email, password: PW }, "ip-f")).rejects.toThrow(/không đúng/);
    expect(await auth.passwordLogin({ email, password: "MoiMoi123" }, "ip-f")).toBe(id);
  });
  it("expired links are refused", async () => {
    const email = fresh();
    await register(email);
    sent.length = 0;
    await auth.requestPasswordReset(email, "ip-g");
    const token = linkToken(sent[0].text);
    await run("UPDATE auth_tokens SET expires_at = ? WHERE purpose = 'reset'", [new Date(Date.now() - 1000).toISOString()]);
    expect(await auth.resetTokenStatus(token)).toBe("expired");
    await expect(auth.resetPassword({ token, password: "MoiMoi123", confirm: "MoiMoi123" })).rejects.toThrow(/hết hạn/);
  });
  it("limits reset requests per email", async () => {
    const email = fresh();
    await register(email);
    for (let i = 0; i < 3; i++) await auth.requestPasswordReset(email, "ip-h");
    expect((await auth.requestPasswordReset(email, "ip-h").catch((e) => e)).code).toBe("rate_limited");
  });
});

describe("social sign-in", () => {
  it("creates an account, then recognises the same identity", async () => {
    const email = fresh();
    const id = await auth.socialSignIn({ provider: "google", subject: "g-1", email, emailVerified: true, name: "Gia" });
    expect(await auth.socialSignIn({ provider: "google", subject: "g-1", email: "changed@x.vn", emailVerified: true, name: "Gia" })).toBe(id);
    // No password yet: password login refuses with the generic message.
    expect((await auth.passwordLogin({ email, password: "bat-ky-123" }, "ip-i").catch((e) => e)).code).toBe("invalid");
  });
  it("links a Google-verified email to the existing account", async () => {
    const email = fresh();
    const { id } = await register(email);
    expect(await auth.socialSignIn({ provider: "google", subject: "g-2", email, emailVerified: true, name: "X" })).toBe(id);
  });
  it("never links an unverified (Facebook) email to an existing account", async () => {
    const email = fresh();
    await register(email);
    const e = await auth.socialSignIn({ provider: "facebook", subject: "f-1", email, emailVerified: false, name: "X" }).catch((x) => x);
    expect(e.code).toBe("email_conflict");
    expect((await auth.socialSignIn({ provider: "facebook", subject: "f-2", email: null, emailVerified: false, name: "X" }).catch((x) => x)).code).toBe("no_email");
  });
  it("refuses locked accounts", async () => {
    const email = fresh();
    const id = await auth.socialSignIn({ provider: "facebook", subject: "f-3", email, emailVerified: false, name: "Y" });
    await run("UPDATE members SET locked = 1 WHERE id = ?", [id]);
    expect((await auth.socialSignIn({ provider: "facebook", subject: "f-3", email, emailVerified: false, name: "Y" }).catch((x) => x)).code).toBe("locked");
  });
});

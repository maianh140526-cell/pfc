import bcrypt from "bcryptjs";
import sharp from "sharp";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { cleanupTempDbs, useTempDb } from "../../../test/db";

useTempDb();
process.env.PFC_UPLOAD_DIR = ".data/test/uploads";
process.env.PFC_ENCRYPTION_KEY = "test-encryption-key-0123456789abcdef";
const sent: { to: string; subject: string; text: string }[] = [];
vi.mock("@/platform/mail", () => ({
  publicUrl: () => "http://localhost:3200",
  sendMail: async (m: { to: string; subject: string; text: string }) => {
    sent.push(m);
    return true;
  },
}));
const acc = await import("./service");
const { saveImage } = await import("@/platform/uploads/service");
const { totpAt, stepAt } = await import("@/platform/auth/totp");
const { revokeSession, revokeOtherSessions } = await import("@/platform/auth/session");
const { makeMember } = await import("../../../test/members");
const { one, run } = await import("@/platform/db/client");
afterAll(cleanupTempDbs);

type M = Awaited<ReturnType<typeof makeMember>>;
let a: M, b: M;
const PW = "MatKhau123";
const token = (text: string) => /token=([A-Za-z0-9_-]+)/.exec(text)?.[1] ?? "";

beforeAll(async () => {
  a = await makeMember("thanh_vien", null, "An");
  b = await makeMember("thanh_vien", null, "Bình");
  await run("UPDATE members SET password_hash = ? WHERE id IN (?, ?)", [await bcrypt.hash(PW, 4), a.id, b.id]);
});

describe("profile", () => {
  it("validates and saves profile fields", async () => {
    await expect(acc.updateProfile(a, { fullName: "A" })).rejects.toThrow(/họ và tên/);
    await expect(acc.updateProfile(a, { fullName: "An Nguyễn", phone: "12ab" })).rejects.toThrow(/điện thoại/);
    await expect(acc.updateProfile(a, { fullName: "An Nguyễn", birthDate: "2999-01-01" })).rejects.toThrow(/Ngày sinh/);
    await acc.updateProfile(a, { fullName: "An Nguyễn", phone: "0903 123 456", birthDate: "2002-05-01", gender: "female", bio: "Thích đầu tư." });
    const p = await acc.getProfile(a.id);
    expect(p).toMatchObject({ fullName: "An Nguyễn", phone: "0903123456", birthDate: "2002-05-01", gender: "female", bio: "Thích đầu tư.", hasPassword: true });
  });
  it("avatar must be the member's own square-cropped upload", async () => {
    const img = await sharp({ create: { width: 900, height: 600, channels: 3, background: "#7a5af8" } }).png().toBuffer();
    const mine = await saveImage(a, "avatar", img);
    expect([mine.width, mine.height]).toEqual([512, 512]);
    const theirs = await saveImage(b, "avatar", img);
    await expect(acc.setAvatar(a, theirs.url)).rejects.toThrow(/không phải của bạn/);
    await acc.setAvatar(a, mine.url);
    expect((await acc.getProfile(a.id)).avatarUrl).toBe(mine.url);
    await acc.setAvatar(a, null);
    expect((await acc.getProfile(a.id)).avatarUrl).toBeNull();
  });
});

describe("email change", () => {
  it("needs the password, confirms via the new address, and warns the old one", async () => {
    await expect(acc.requestEmailChange(a, { email: "an.moi@pfc.test", password: "sai" })).rejects.toThrow(/Mật khẩu không đúng/);
    await expect(acc.requestEmailChange(a, { email: b.email, password: PW })).rejects.toThrow(/tài khoản khác/);
    sent.length = 0;
    await acc.requestEmailChange(a, { email: "an.moi@pfc.test", password: PW });
    expect(sent.map((m) => m.to)).toEqual(["an.moi@pfc.test", a.email]);
    expect((await acc.getProfile(a.id)).email).toBe(a.email); // not changed yet
    const t = token(sent[0].text);
    await acc.confirmEmailChange(t);
    expect((await acc.getProfile(a.id)).email).toBe("an.moi@pfc.test");
    await expect(acc.confirmEmailChange(t)).rejects.toThrow(/đã được sử dụng/);
    a.email = "an.moi@pfc.test";
  });
});

describe("two-step login", () => {
  let secret = "";
  let backups: string[] = [];
  it("turns on only after a valid code and returns backup codes once", async () => {
    expect((await acc.twoFactorStatus(a.id)).enabled).toBe(false);
    ({ secret } = await acc.startTwoFactor(a));
    expect((await one<{ secret_enc: string }>("SELECT secret_enc FROM member_totp WHERE member_id = ?", [a.id]))?.secret_enc).not.toContain(secret);
    await expect(acc.confirmTwoFactor(a, "000000")).rejects.toThrow(/Mã không đúng/);
    // The setup code is the previous step, so the next login code (current step) is still fresh.
    backups = await acc.confirmTwoFactor(a, totpAt(secret, stepAt(Date.now()) - 1));
    expect(backups).toHaveLength(8);
    expect(await acc.twoFactorStatus(a.id)).toEqual({ enabled: true, backupLeft: 8 });
  });
  it("locks after 5 wrong codes", async () => {
    const c = await makeMember();
    const { secret: s2 } = await acc.startTwoFactor(c);
    await acc.confirmTwoFactor(c, totpAt(s2, stepAt(Date.now()) - 1));
    for (let i = 0; i < 5; i++) expect(await acc.verifySecondFactor(c.id, "000000")).toBe(false);
    await expect(acc.verifySecondFactor(c.id, totpAt(s2, stepAt(Date.now())))).rejects.toThrow(/quá nhiều lần/);
  });
  it("accepts a fresh code once (no replay) and each backup code once", async () => {
    const code = totpAt(secret, stepAt(Date.now()));
    expect(await acc.verifySecondFactor(a.id, code)).toBe(true);
    expect(await acc.verifySecondFactor(a.id, code)).toBe(false);
    expect(await acc.verifySecondFactor(a.id, backups[0].toLowerCase())).toBe(true);
    expect(await acc.verifySecondFactor(a.id, backups[0])).toBe(false);
    expect((await acc.twoFactorStatus(a.id)).backupLeft).toBe(7);
  });
  it("members without 2FA pass; disabling needs password + code", async () => {
    expect(await acc.verifySecondFactor(b.id, "")).toBe(true);
    await expect(acc.disableTwoFactor(a, { password: PW, code: "000000" })).rejects.toThrow(/không đúng/);
    await acc.disableTwoFactor(a, { password: PW, code: backups[1] });
    expect((await acc.twoFactorStatus(a.id)).enabled).toBe(false);
  });
});

describe("privacy, linked accounts, sessions", () => {
  it("findByEmail=false hides the member from project invites by email", async () => {
    const prj = await import("@/modules/projects/server/service");
    const pid = await prj.createProject(a, { title: "Dự án riêng tư", summary: "Kiểm tra quyền tìm theo email.", category: "fintech" });
    await acc.setPrivacy(b, { profileVisibility: "members", findByEmail: false });
    await expect(prj.inviteMember(a, pid, { email: b.email, role: "member" })).rejects.toThrow(/Không có tài khoản/);
    await acc.setPrivacy(b, { profileVisibility: "members", findByEmail: true });
    await prj.inviteMember(a, pid, { email: b.email, role: "member" });
    expect((await acc.consentHistory(b.id)).filter((c) => c.kind === "privacy_settings")).toHaveLength(2);
  });
  it("never removes the last way to sign in", async () => {
    const c = await makeMember("thanh_vien", null, "Chỉ Google");
    await acc.linkIdentity(c.id, { provider: "google", subject: "g-c", email: c.email });
    await expect(acc.unlinkIdentity(c, "google")).rejects.toThrow(/duy nhất/);
    await acc.linkIdentity(c.id, { provider: "facebook", subject: "f-c", email: null });
    await acc.unlinkIdentity(c, "google");
    expect((await acc.linkedAccounts(c.id)).map((x) => x.provider)).toEqual(["facebook"]);
    await expect(acc.linkIdentity(a.id, { provider: "facebook", subject: "f-c", email: null })).rejects.toThrow(/tài khoản PFC khác/);
  });
  it("revokes only the member's own sessions", async () => {
    const t = new Date().toISOString();
    for (const [id, m] of [["s1", a.id], ["s2", a.id], ["s3", b.id]] as const) {
      await run("INSERT INTO member_sessions (id, member_id, device, created_at, last_seen_at) VALUES (?, ?, 'Chrome · Windows', ?, ?)", [id, m, t, t]);
    }
    expect(await revokeSession(b.id, "s1")).toBe(false);
    expect(await revokeOtherSessions(a.id, "s1")).toBe(1);
    expect((await one<{ revoked_at: string | null }>("SELECT revoked_at FROM member_sessions WHERE id = 's1'"))?.revoked_at).toBeNull();
    expect((await one<{ revoked_at: string | null }>("SELECT revoked_at FROM member_sessions WHERE id = 's3'"))?.revoked_at).toBeNull();
  });
});

describe("personal data", () => {
  it("exports own data without secrets", async () => {
    const data = await acc.exportMyData(a);
    expect(data.profile).toMatchObject({ id: a.id });
    expect(JSON.stringify(data)).not.toMatch(/password_hash|secret_enc|\$2[aby]\$/);
    expect(Array.isArray(data.prj_projects)).toBe(true);
  });
  it("deletion needs the typed email + password, refuses the last Chủ nhiệm and active projects", async () => {
    const boss = await makeMember("chu_nhiem", null, "Chủ nhiệm");
    await expect(acc.deleteAccount(boss, { confirm: boss.email })).rejects.toThrow(/Chủ nhiệm duy nhất/);
    await expect(acc.deleteAccount(a, { confirm: "sai@email", password: PW })).rejects.toThrow(/Nhập đúng email/);
    const prj = await import("@/modules/projects/server/service");
    const pid = await prj.createProject(b, { title: "Dự án đang chạy", summary: "Chặn xóa tài khoản khi còn dự án.", category: "fintech" });
    await prj.projectTransition(b, pid, "submit");
    await expect(acc.deleteAccount(b, { confirm: b.email, password: PW })).rejects.toThrow(/dự án đang hoạt động/);
  });
  it("anonymises the account and removes personal data", async () => {
    await acc.deleteAccount(a, { confirm: a.email, password: PW });
    const row = await one<{ email: string; full_name: string; deleted_at: string | null; phone: string | null }>("SELECT email, full_name, deleted_at, phone FROM members WHERE id = ?", [a.id]);
    expect(row).toMatchObject({ full_name: "Tài khoản đã xóa", phone: null });
    expect(row?.email).toMatch(/^deleted\+/);
    expect(row?.deleted_at).toBeTruthy();
    expect(await one("SELECT 1 AS x FROM member_sessions WHERE member_id = ?", [a.id])).toBeNull();
  });
});

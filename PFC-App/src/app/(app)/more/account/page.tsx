import { Bell, Database, KeyRound, Languages, Link2, LogOut, MonitorSmartphone, Palette, ShieldCheck, UserRound, UserLock } from "lucide-react";
import { getProfile, linkedAccounts, twoFactorStatus } from "@/platform/account/service";
import { logoutAction } from "@/platform/auth/actions";
import { requireMember } from "@/platform/auth/session";
import { AppHeader, Badge, ListGroup, ListItem, Section } from "@/ui";
import { Avatar } from "@/ui/Avatar";

export const metadata = { title: "Cài đặt tài khoản" };
export const dynamic = "force-dynamic";

/** MEM-03 Account Settings (mockup 265). */
export default async function AccountSettingsPage() {
  const me = await requireMember("/more/account");
  const [p, tfa, links] = await Promise.all([getProfile(me.id), twoFactorStatus(me.id), linkedAccounts(me.id)]);
  return (
    <>
      <AppHeader back backFallback="/more" title="Cài đặt tài khoản" />
      <Section>
        <div className="flex flex-col items-center gap-2 rounded-[var(--radius-card)] bg-primary-soft p-5 text-center">
          <Avatar name={p.fullName} url={p.avatarUrl} size={72} />
          <p className="text-[17px] font-bold text-ink">{p.fullName}</p>
          <p className="text-[13px] text-muted">{p.email}</p>
        </div>
      </Section>
      <Section>
        <ListGroup label="Tài khoản">
          <ListItem icon={UserRound} title="Thông tin cá nhân" href="/more/account/profile" />
          {p.hasPassword ? (
            <ListItem icon={KeyRound} title="Đổi mật khẩu" href="/more/password" />
          ) : (
            <ListItem icon={KeyRound} title="Tạo mật khẩu" description="Đang đăng nhập bằng Google/Facebook" href={`/forgot-password?email=${encodeURIComponent(p.email)}`} />
          )}
          <ListItem icon={ShieldCheck} title="Xác thực hai lớp (2FA)" href="/more/account/2fa" trailing={tfa.enabled ? <Badge tone="income">Đã bật</Badge> : <Badge tone="muted">Tắt</Badge>} />
          <ListItem icon={MonitorSmartphone} title="Thiết bị đăng nhập" href="/more/account/devices" />
          <ListItem icon={Link2} title="Liên kết tài khoản" href="/more/account/linked" trailing={links.length ? <Badge>{links.length}</Badge> : undefined} />
        </ListGroup>
      </Section>
      <Section>
        <ListGroup label="Ứng dụng">
          <ListItem icon={Languages} title="Ngôn ngữ" href="/more/account/language" trailing={<span className="text-[13px] text-muted">{p.locale === "en" ? "English" : "Tiếng Việt"}</span>} />
          <ListItem icon={Palette} title="Chế độ hiển thị" href="/more/appearance" />
          <ListItem icon={Bell} title="Thông báo" href="/more/notifications" />
        </ListGroup>
      </Section>
      <Section>
        <ListGroup label="Quyền riêng tư">
          <ListItem icon={UserLock} title="Quyền riêng tư" href="/more/account/privacy" />
          <ListItem icon={Database} title="Dữ liệu cá nhân" description="Tải xuống, chỉnh sửa, xóa tài khoản" href="/more/account/data" />
        </ListGroup>
      </Section>
      <Section>
        <form action={logoutAction}>
          <button type="submit" className="pressable flex min-h-12 w-full items-center justify-center gap-2 rounded-[var(--radius-control)] bg-expense-soft text-[15px] font-semibold text-expense">
            <LogOut size={18} /> Đăng xuất
          </button>
        </form>
      </Section>
    </>
  );
}

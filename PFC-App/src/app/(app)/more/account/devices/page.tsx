import { listSessions, requireMember } from "@/platform/auth/session";
import { AppHeader, Section } from "@/ui";
import { DeviceList } from "./DeviceList";

export const metadata = { title: "Thiết bị đăng nhập" };
export const dynamic = "force-dynamic";

/** MEM-06 Login Sessions (mockup 269). */
export default async function DevicesPage() {
  const me = await requireMember("/more/account/devices");
  const sessions = await listSessions(me.id);
  return (
    <>
      <AppHeader back backFallback="/more/account" title="Thiết bị đăng nhập" />
      <Section>
        <DeviceList sessions={sessions} />
        <p className="mt-3 text-[12px] text-muted">Không nhận ra một thiết bị? Đăng xuất thiết bị đó và đổi mật khẩu. Địa chỉ IP chỉ hiện một phần để bảo vệ quyền riêng tư.</p>
      </Section>
    </>
  );
}

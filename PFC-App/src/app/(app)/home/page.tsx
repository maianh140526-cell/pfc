import Link from "next/link";
import { redirect } from "next/navigation";
import { BookOpen, Briefcase, Rocket, Search, ShoppingBag, Users, Wallet, type LucideIcon } from "lucide-react";
import { HUBS, type HubSlug } from "@/domain/hubs";
import { getProfile } from "@/platform/account/service";
import { orderHubsByInterest } from "@/platform/account/options";
import { currentMember } from "@/platform/auth/session";
import { unreadCount } from "@/platform/notifications/service";
import { InstallCard } from "@/platform/pwa/InstallCard";
import { AppHeader, Badge, ButtonLink, Section } from "@/ui";
import { Avatar } from "@/ui/Avatar";
import { NotificationBell } from "@/ui/NotificationBell";

export const metadata = { title: "Trang chủ" };
export const dynamic = "force-dynamic";

const HUB_ICONS: Record<HubSlug, { icon: LucideIcon; tone: string }> = {
  finance: { icon: Wallet, tone: "bg-income-soft text-income" },
  learn: { icon: BookOpen, tone: "bg-primary-soft text-primary" },
  projects: { icon: Rocket, tone: "bg-primary-soft text-primary" },
  marketplace: { icon: ShoppingBag, tone: "bg-warning-soft text-warning" },
  opportunities: { icon: Briefcase, tone: "bg-expense-soft text-expense" },
  club: { icon: Users, tone: "bg-primary-soft text-primary" },
};

/** Greeting by Vietnam local time. */
function greeting(): string {
  const h = Number(new Date().toLocaleString("en-GB", { hour: "2-digit", hour12: false, timeZone: "Asia/Ho_Chi_Minh" }));
  return h < 11 ? "Chào buổi sáng" : h < 14 ? "Chào buổi trưa" : h < 18 ? "Chào buổi chiều" : "Chào buổi tối";
}

/** SYS-08 Home / Personal Dashboard (mockup 8). */
export default async function HomePage() {
  const me = await currentMember();
  if (me && !me.onboarded) redirect("/welcome");
  const [profile, unread] = me ? await Promise.all([getProfile(me.id), unreadCount(me.id)]) : [null, 0];
  const hubs = orderHubsByInterest(HUBS, profile?.interests ?? []);

  return (
    <>
      <AppHeader actions={me ? <NotificationBell count={unread} /> : undefined} />
      <div className="flex items-center gap-3 px-4 pt-1">
        <div className="min-w-0 flex-1">
          <p className="text-[15px] text-muted">{me ? `${greeting()},` : "Xin chào,"}</p>
          <h1 className="truncate text-[24px] font-extrabold text-ink">{me ? me.fullName : "Chào mừng đến PFC"}</h1>
          <p className="mt-0.5 text-[14px] text-ink-2">Small steps, big progress!</p>
        </div>
        {me && (
          <Link href="/more" aria-label="Hồ sơ của tôi">
            <Avatar name={me.fullName} url={me.avatarUrl} size={56} />
          </Link>
        )}
      </div>
      <div className="px-4 pt-4">
        <Link href="/search" className="flex min-h-12 items-center gap-2 rounded-full border border-line bg-surface px-4 text-[15px] text-muted">
          <Search size={18} /> Tìm khóa học, cơ hội, dự án, sản phẩm…
        </Link>
      </div>
      {!me && (
        <Section>
          <div className="grid grid-cols-2 gap-3">
            <ButtonLink href="/register">Tham gia PFC</ButtonLink>
            <ButtonLink href="/login" variant="secondary">
              Đăng nhập
            </ButtonLink>
          </div>
        </Section>
      )}
      <Section>
        <InstallCard />
      </Section>
      <Section title={profile?.interests.length ? "Dành cho bạn" : "Khám phá"}>
        <ul className="grid grid-cols-2 gap-3">
          {hubs.map((hub) => {
            const { icon: Icon, tone } = HUB_ICONS[hub.slug];
            return (
              <li key={hub.slug}>
                <Link href={hub.href} className="pressable flex h-full flex-col gap-3 rounded-[var(--radius-card)] border border-line bg-surface p-4 shadow-card">
                  <span className={`grid size-11 place-items-center rounded-2xl ${tone}`}>
                    <Icon size={22} />
                  </span>
                  <span>
                    <span className="block text-[15px] font-bold text-ink">{hub.title}</span>
                    <span className="mt-0.5 block text-[12px] leading-snug text-muted">{hub.subtitle}</span>
                  </span>
                  {!hub.ready && (
                    <span className="mt-auto self-start">
                      <Badge tone="muted">Sắp có · {hub.phase}</Badge>
                    </span>
                  )}
                </Link>
              </li>
            );
          })}
        </ul>
      </Section>
    </>
  );
}

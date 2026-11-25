import Link from "next/link";
import { BellOff, BookOpen, Briefcase, CalendarDays, CreditCard, Gift, LifeBuoy, Megaphone, MessageCircle, Rocket, Settings, ShieldCheck, ShoppingBag, Users } from "lucide-react";
import { requireMember } from "@/platform/auth/session";
import { CATEGORIES, type Category } from "@/platform/notifications/categories";
import { listNotifications, pruneOld, unreadCount } from "@/platform/notifications/service";
import { AppHeader, EmptyState, Section } from "@/ui";
import { FilterChips } from "@/ui/FilterChips";
import { cx } from "@/ui/cx";
import { MarkAllRead } from "./MarkAllRead";

export const metadata = { title: "Thông báo" };
export const dynamic = "force-dynamic";

const ICON: Record<Category, { icon: typeof ShieldCheck; tone: string }> = {
  account: { icon: ShieldCheck, tone: "bg-expense-soft text-expense" },
  market: { icon: ShoppingBag, tone: "bg-warning-soft text-warning" },
  projects: { icon: Rocket, tone: "bg-primary-soft text-primary" },
  learn: { icon: BookOpen, tone: "bg-income-soft text-income" },
  community: { icon: Users, tone: "bg-primary-soft text-primary" },
  messages: { icon: MessageCircle, tone: "bg-primary-soft text-primary" },
  events: { icon: CalendarDays, tone: "bg-warning-soft text-warning" },
  payments: { icon: CreditCard, tone: "bg-income-soft text-income" },
  rewards: { icon: Gift, tone: "bg-warning-soft text-warning" },
  announcements: { icon: Megaphone, tone: "bg-primary-soft text-primary" },
  support: { icon: LifeBuoy, tone: "bg-income-soft text-income" },
};

function ago(iso: string): string {
  const s = Math.max(0, (Date.now() - Date.parse(iso)) / 1000);
  if (s < 60) return "vừa xong";
  if (s < 3600) return `${Math.floor(s / 60)} phút trước`;
  if (s < 86400) return `${Math.floor(s / 3600)} giờ trước`;
  if (s < 7 * 86400) return `${Math.floor(s / 86400)} ngày trước`;
  return new Date(iso).toLocaleDateString("vi-VN");
}

/** NOT-01 Notification Center (mockup 11). */
export default async function NotificationsPage({ searchParams }: { searchParams: Promise<{ tab?: string }> }) {
  const { tab } = await searchParams;
  const me = await requireMember("/notifications");
  await pruneOld(me.id);
  const key = tab === "unread" || (tab && tab in CATEGORIES) ? tab : "all";
  const [items, unread] = await Promise.all([
    listNotifications(me.id, { unread: key === "unread", category: key !== "all" && key !== "unread" ? key : undefined, limit: 100 }),
    unreadCount(me.id),
  ]);
  return (
    <>
      <AppHeader
        title="Thông báo"
        actions={
          <Link href="/more/notifications" aria-label="Cài đặt thông báo" className="grid size-11 place-items-center rounded-full text-ink active:bg-surface-2">
            <Settings size={22} />
          </Link>
        }
      />
      <div className="flex items-center justify-between gap-2 px-4">
        <FilterChips
          label="Lọc thông báo"
          value={key}
          hrefFor={(t) => (t === "all" ? "/notifications" : `/notifications?tab=${t}`)}
          options={[
            { value: "all", label: "Tất cả" },
            { value: "unread", label: `Chưa đọc${unread ? ` (${unread})` : ""}` },
            ...(Object.keys(CATEGORIES) as Category[]).map((c) => ({ value: c, label: CATEGORIES[c].label })),
          ]}
        />
      </div>
      {unread > 0 && (
        <div className="flex justify-end px-4 pt-2">
          <MarkAllRead />
        </div>
      )}
      {items.length === 0 ? (
        <EmptyState icon={BellOff} title={key === "unread" ? "Bạn đã đọc hết thông báo" : "Chưa có thông báo"} description="Đơn hàng, dự án, học tập và bảo mật tài khoản sẽ hiện ở đây." />
      ) : (
        <ul className="divide-y divide-line px-4 pt-2">
          {items.map((n) => {
            const { icon: Icon, tone } = ICON[n.category];
            return (
              <li key={n.id}>
                <a href={`/notifications/open/${n.id}`} className="flex gap-3 py-3 active:bg-surface-2">
                  <span className={cx("grid size-11 shrink-0 place-items-center rounded-2xl", tone)}>
                    <Icon size={20} />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className={cx("block text-[15px] leading-snug text-ink", !n.readAt && "font-bold")}>{n.title}</span>
                    {n.body && <span className="mt-0.5 line-clamp-2 block text-[13px] text-ink-2">{n.body}</span>}
                    <span className="mt-0.5 block text-[12px] text-muted">{ago(n.createdAt)}</span>
                  </span>
                  {!n.readAt && <span className="mt-1.5 size-2.5 shrink-0 rounded-full bg-primary" aria-label="Chưa đọc" />}
                </a>
              </li>
            );
          })}
        </ul>
      )}
      <Section title="Thông báo trong các nhánh">
        <div className="grid grid-cols-2 gap-3">
          <Link href="/club/notifications" className="pressable flex items-center gap-2 rounded-[var(--radius-card)] border border-line bg-surface p-3.5 text-[14px] font-semibold text-ink">
            <Users size={18} className="text-primary" /> Câu lạc bộ
          </Link>
          <Link href="/opportunities/notifications" className="pressable flex items-center gap-2 rounded-[var(--radius-card)] border border-line bg-surface p-3.5 text-[14px] font-semibold text-ink">
            <Briefcase size={18} className="text-primary" /> Cơ hội
          </Link>
        </div>
      </Section>
    </>
  );
}

import Link from "next/link";
import { CalendarDays, MessageCircle, Newspaper, Search, ShieldAlert, Users, UsersRound } from "lucide-react";
import { currentMember, toActor } from "@/platform/auth/session";
import { can } from "@/platform/roles";
import { communityStats, feed } from "@/modules/community/server/service";
import { unreadMessages } from "@/modules/community/server/messages";
import { PostCard } from "@/modules/community/ui/PostCard";
import { AppHeader, ButtonLink, EmptyState, FabLink, Section } from "@/ui";

export const metadata = { title: "Cộng đồng" };
export const dynamic = "force-dynamic";

/** COM-01 Community Home (mockup 73). */
export default async function CommunityHome() {
  const me = await currentMember();
  const actor = me ? toActor(me) : null;
  const [top, latest, stats, unread] = await Promise.all([feed(actor, { tab: "top", limit: 3 }), feed(actor, { tab: "latest", limit: 10 }), communityStats(), me ? unreadMessages(toActor(me)) : 0]);
  const quick = [
    { href: "/community/posts", label: "Bài viết", icon: Newspaper },
    { href: "/community/groups", label: "Nhóm", icon: UsersRound },
    { href: "/events", label: "Sự kiện", icon: CalendarDays },
    { href: "/community/members", label: "Thành viên", icon: Users },
  ];
  return (
    <>
      <AppHeader
        title="Cộng đồng"
        subtitle="Kết nối · Chia sẻ · Cùng phát triển"
        actions={
          <>
            <Link href="/search" aria-label="Tìm kiếm" className="grid size-11 place-items-center rounded-full text-ink active:bg-surface-2">
              <Search size={22} />
            </Link>
            {me && (
              <Link href="/messages" aria-label={unread ? `Tin nhắn, ${unread} chưa đọc` : "Tin nhắn"} className="relative grid size-11 place-items-center rounded-full text-ink active:bg-surface-2">
                <MessageCircle size={22} />
                {unread > 0 && <span className="absolute top-1.5 right-1.5 grid h-[18px] min-w-[18px] place-items-center rounded-full bg-expense px-1 text-[11px] font-bold text-surface">{unread > 99 ? "99+" : unread}</span>}
              </Link>
            )}
          </>
        }
      />
      <div className="px-4">
        <div className="rounded-[var(--radius-card)] bg-primary p-5 text-on-primary shadow-sheet">
          <p className="text-[18px] leading-snug font-extrabold">Cộng đồng mạnh hơn khi cùng nhau chia sẻ</p>
          <p className="mt-1 text-[13px] opacity-90">
            {stats.members} thành viên · {stats.groups} nhóm · {stats.posts} bài viết
          </p>
          <Link href={me ? "/community/posts/new" : "/login?next=/community"} className="mt-3 inline-flex rounded-full bg-on-primary px-4 py-2 text-[13px] font-bold text-primary">
            {me ? "Chia sẻ ngay" : "Tham gia ngay"}
          </Link>
        </div>
      </div>
      <Section>
        <ul className="grid grid-cols-4 gap-2 text-center">
          {quick.map(({ href, label, icon: Icon }) => (
            <li key={href}>
              <Link href={href} className="pressable flex flex-col items-center gap-1.5 text-[12px] font-semibold text-ink-2">
                <span className="grid size-12 place-items-center rounded-2xl bg-primary-soft text-primary">
                  <Icon size={22} />
                </span>
                {label}
              </Link>
            </li>
          ))}
        </ul>
      </Section>
      <Section>
        <Link href="/club" className="pressable flex items-center gap-3 rounded-[var(--radius-card)] border border-line bg-surface p-4">
          <span className="grid size-11 place-items-center rounded-2xl bg-primary text-on-primary">
            <Users size={22} />
          </span>
          <span className="min-w-0 flex-1">
            <span className="block text-[15px] font-bold text-ink">Câu lạc bộ PFC</span>
            <span className="block text-[12px] text-muted">Công việc, hoạt động, thành viên chính thức của CLB</span>
          </span>
        </Link>
      </Section>
      {me && can(toActor(me), "community.moderate") && (
        <Section>
          <ButtonLink href="/community/manage" variant="secondary" block>
            <ShieldAlert size={18} /> Báo cáo vi phạm cần xử lý
          </ButtonLink>
        </Section>
      )}
      {top.length > 0 && (
        <Section
          title="Bài viết nổi bật"
          action={
            <Link href="/community/posts?tab=top" className="text-[14px] font-semibold text-primary">
              Xem tất cả
            </Link>
          }
        >
          <ul className="space-y-3">
            {top.map((p) => (
              <li key={p.id}>
                <PostCard p={p} signedIn={!!me} />
              </li>
            ))}
          </ul>
        </Section>
      )}
      <Section title="Mới nhất">
        {latest.length === 0 ? (
          <EmptyState icon={Newspaper} title="Chưa có bài viết" description="Hãy là người đầu tiên chia sẻ kinh nghiệm tài chính của bạn." />
        ) : (
          <ul className="space-y-3">
            {latest.map((p) => (
              <li key={p.id}>
                <PostCard p={p} signedIn={!!me} />
              </li>
            ))}
          </ul>
        )}
      </Section>
      {me && (
        <FabLink href="/community/posts/new" label="Viết bài" />
      )}
    </>
  );
}

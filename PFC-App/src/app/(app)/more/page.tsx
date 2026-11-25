import Link from "next/link";
import { Bell, ChevronRight, CircleHelp, CreditCard, Gift, LayoutDashboard, LifeBuoy, MessageCircle, Ticket, FileText, Info, LayoutGrid, LogOut, Settings, ShieldCheck, UserCog, UserRound } from "lucide-react";
import { DEPARTMENT_LABEL, ROLE_LABEL, can } from "@/platform/roles";
import { logoutAction } from "@/platform/auth/actions";
import { currentMember, toActor } from "@/platform/auth/session";
import { one } from "@/platform/db/client";
import { unreadCount } from "@/platform/notifications/service";
import { InstallCard } from "@/platform/pwa/InstallCard";
import { AppHeader, Badge, ButtonLink, ListGroup, ListItem, Section } from "@/ui";
import { Avatar } from "@/ui/Avatar";

export const metadata = { title: "Thêm" };
export const dynamic = "force-dynamic";

/** SYS-12 Profile / MEM-01 My Profile / SYS-14 Settings entry (mockup 12 / 87). Stats are live counts. */
export default async function MorePage() {
  const me = await currentMember();
  const [unread, stats] = me
    ? await Promise.all([
        unreadCount(me.id),
        one<{ courses: number; projects: number; orders: number }>(
          `SELECT (SELECT COUNT(*) FROM edu_enrollments WHERE member_id = ?) AS courses,
                  (SELECT COUNT(*) FROM prj_members WHERE member_id = ? AND status = 'active') AS projects,
                  (SELECT COUNT(*) FROM mkt_orders WHERE buyer_id = ?) AS orders`,
          [me.id, me.id, me.id],
        ),
      ])
    : [0, null];
  return (
    <>
      <AppHeader
        title="Thêm"
        actions={
          me ? (
            <Link href="/more/account" aria-label="Cài đặt tài khoản" className="grid size-11 place-items-center rounded-full text-ink active:bg-surface-2">
              <Settings size={22} />
            </Link>
          ) : undefined
        }
      />
      <Section>
        {me ? (
          <div className="rounded-[var(--radius-card)] border border-line bg-surface p-4">
            <Link href="/more/account/profile" className="flex items-center gap-3">
              <Avatar name={me.fullName} url={me.avatarUrl} size={64} />
              <span className="min-w-0 flex-1">
                <span className="block truncate text-[17px] font-bold text-ink">{me.fullName}</span>
                <span className="block truncate text-[13px] text-muted">{me.email}</span>
                <span className="block text-[12px] font-semibold text-primary">
                  {ROLE_LABEL[me.role]}
                  {me.department ? ` · ${DEPARTMENT_LABEL[me.department]}` : ""}
                </span>
              </span>
              <ChevronRight size={20} className="text-muted" />
            </Link>
            {stats && (
              <ul className="mt-4 grid grid-cols-3 border-t border-line pt-3 text-center">
                {[
                  [stats.courses, "Khóa học", "/learn/me"],
                  [stats.projects, "Dự án", "/projects/mine"],
                  [stats.orders, "Đơn mua", "/market/orders"],
                ].map(([n, label, href]) => (
                  <li key={String(label)}>
                    <Link href={String(href)} className="block">
                      <span className="block text-[18px] font-extrabold text-ink">{Number(n)}</span>
                      <span className="block text-[12px] text-muted">{label}</span>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </div>
        ) : (
          <div className="rounded-[var(--radius-card)] border border-line bg-surface p-4">
            <div className="flex items-center gap-3">
              <span className="grid size-14 place-items-center rounded-full bg-primary-soft text-primary">
                <UserRound size={28} />
              </span>
              <div>
                <p className="text-[16px] font-bold text-ink">Chưa đăng nhập</p>
                <p className="text-[13px] text-muted">Một tài khoản PFC cho mọi nhánh.</p>
              </div>
            </div>
            <div className="mt-4 grid grid-cols-2 gap-3">
              <ButtonLink href="/login?next=/more">Đăng nhập</ButtonLink>
              <ButtonLink href="/register?next=/more" variant="secondary">
                Đăng ký
              </ButtonLink>
            </div>
          </div>
        )}
      </Section>
      <Section>
        <InstallCard />
      </Section>
      {me && (
        <Section>
          <ListGroup label="Tài khoản">
            <ListItem icon={UserRound} title="Hồ sơ của tôi" href="/more/account/profile" />
            <ListItem icon={Settings} title="Cài đặt tài khoản" description="Bảo mật, thiết bị, quyền riêng tư, dữ liệu" href="/more/account" />
            <ListItem icon={Bell} title="Thông báo" href="/notifications" trailing={unread > 0 ? <Badge tone="expense">{unread}</Badge> : undefined} />
            <ListItem icon={MessageCircle} title="Tin nhắn" href="/messages" />
            <ListItem icon={Gift} title="Điểm thưởng & hạng thành viên" description="Tích điểm, đổi quà, giới thiệu bạn bè" href="/rewards" />
            <ListItem icon={Ticket} title="Vé sự kiện của tôi" href="/events/tickets" />
            <ListItem icon={CreditCard} title="Thanh toán & hoàn tiền" description="Lịch sử giao dịch VNPAY, hoàn tiền, chi trả" href="/payments" />
            {can(toActor(me), "admin.dashboard") && <ListItem icon={LayoutDashboard} title="Quản trị" description="Bảng điều khiển, hàng chờ, nhật ký, cấu hình" href="/admin" />}
            <ListItem icon={LifeBuoy} title="Hỗ trợ" description="Yêu cầu hỗ trợ của bạn" href="/more/support" />
            {can(toActor(me), "admin.members.view") && <ListItem icon={UserCog} title="Quản lý tài khoản" description="Vai trò, khóa tài khoản" href="/more/admin" />}
          </ListGroup>
        </Section>
      )}
      <Section>
        <ListGroup label="Hỗ trợ">
          <ListItem icon={CircleHelp} title="Trợ giúp & câu hỏi thường gặp" href="/more/help" />
          <ListItem icon={ShieldCheck} title="Phân quyền" description="Ai được làm gì trong PFC" href="/more/roles" />
          <ListItem icon={FileText} title="Chính sách & Điều khoản" href="/more/policies" />
          <ListItem icon={Info} title="Về ứng dụng" href="/more/about" />
          <ListItem icon={LayoutGrid} title="Bộ giao diện (UI kit)" href="/more/ui-kit" />
        </ListGroup>
      </Section>
      {me && (
        <Section>
          <form action={logoutAction}>
            <button type="submit" className="pressable flex min-h-12 w-full items-center justify-center gap-2 rounded-[var(--radius-control)] bg-expense-soft text-[15px] font-semibold text-expense">
              <LogOut size={18} /> Đăng xuất
            </button>
          </form>
          <p className="mt-3 text-center text-[12px] text-muted">Đăng xuất khỏi PFC và mọi nhánh (Câu lạc bộ, Cơ hội…).</p>
        </Section>
      )}
    </>
  );
}

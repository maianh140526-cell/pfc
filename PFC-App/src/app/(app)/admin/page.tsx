import Link from "next/link";
import { notFound } from "next/navigation";
import { ChevronRight, ClipboardList, Database, Gift, LifeBuoy, Megaphone, ScrollText, Settings2, Users } from "lucide-react";
import { requireMember, toActor } from "@/platform/auth/session";
import { dashboard } from "@/platform/admin/console";
import { can } from "@/platform/roles";
import { formatVnd } from "@/lib/money";
import { AppHeader, Badge, Card, ListGroup, ListItem, Section } from "@/ui";

export const metadata = { title: "Quản trị" };
export const dynamic = "force-dynamic";

/** ADM-01 Admin dashboard: key numbers, system status, every hub's moderation / approval queue. */
export default async function AdminHome() {
  const me = await requireMember("/admin");
  const actor = toActor(me);
  if (!can(actor, "admin.dashboard")) notFound();
  const d = await dashboard(actor);
  const k = d.kpis;
  const tiles = [
    ["Thành viên", k.members.toLocaleString("vi-VN"), `+${k.newMembers} trong 7 ngày`],
    ["Hoạt động 7 ngày", k.active7.toLocaleString("vi-VN"), "có phiên đăng nhập"],
    ["Bài viết 7 ngày", k.posts7.toLocaleString("vi-VN"), "cộng đồng"],
    ["Đơn hàng 30 ngày", k.orders30.toLocaleString("vi-VN"), `VNPAY ${formatVnd(k.gmv30)}`],
    ["Sự kiện đang mở", k.events.toLocaleString("vi-VN"), `${k.registrations30} lượt đăng ký 30 ngày`],
    ["Tài khoản bị khóa", k.locked.toLocaleString("vi-VN"), `${k.tickets} yêu cầu hỗ trợ mở`],
  ];
  const pending = d.queues.reduce((s, q) => s + q.count, 0);
  return (
    <>
      <AppHeader back backFallback="/more" title="Quản trị" subtitle={pending ? `${pending} việc đang chờ xử lý` : "Không có việc tồn đọng"} />
      <Section>
        <div className="grid grid-cols-2 gap-2">
          {tiles.map(([label, value, sub]) => (
            <Card key={label} className="p-3">
              <p className="text-[12px] text-muted">{label}</p>
              <p className="text-[20px] font-extrabold text-ink">{value}</p>
              <p className="text-[11px] text-muted">{sub}</p>
            </Card>
          ))}
        </div>
      </Section>
      <Section title="Hàng chờ xử lý">
        <ul className="divide-y divide-line overflow-hidden rounded-[var(--radius-card)] border border-line bg-surface">
          {d.queues.map((q) => (
            <li key={q.key}>
              <Link href={q.href} className="flex min-h-12 items-center gap-3 px-4 py-2.5 active:bg-surface-2">
                <span className="flex-1 text-[14px] text-ink">{q.label}</span>
                <Badge tone={q.count ? "warning" : "muted"}>{q.count}</Badge>
                <ChevronRight size={16} className="text-muted" />
              </Link>
            </li>
          ))}
        </ul>
      </Section>
      <Section title="Tình trạng hệ thống">
        <Card className="space-y-1 text-[14px]">
          <p className="flex justify-between">
            <span className="text-muted">Cơ sở dữ liệu</span>
            <b className={d.system.db === "up" ? "text-income" : "text-expense"}>{d.system.db === "up" ? `Hoạt động · ${d.system.dbKind}` : "Không kết nối được"}</b>
          </p>
          <p className="flex justify-between gap-3">
            <span className="text-muted">Cấu hình</span>
            <b className={d.system.problems.length ? "text-expense" : "text-income"}>{d.system.problems.length ? `Thiếu: ${d.system.problems.join(", ")}` : "Đủ"}</b>
          </p>
          <p className="flex justify-between">
            <span className="text-muted">Tính năng đang tắt / cảnh báo</span>
            <b className="text-ink">{d.system.warnings}</b>
          </p>
          <p className="pt-1 text-[12px] text-muted">Sao lưu: Turso tự lưu bản khôi phục theo thời điểm; cách khôi phục xem DEPLOY.md mục 11. Trạng thái chi tiết: /api/health.</p>
        </Card>
      </Section>
      <Section title="Công cụ">
        <ListGroup>
          {can(actor, "admin.members.view") && <ListItem icon={Users} title="Tài khoản thành viên" description="Vai trò, khóa, hạn chế, điểm" href="/more/admin" />}
          {can(actor, "admin.audit.view") && <ListItem icon={ScrollText} title="Nhật ký hệ thống" description="Thao tác quản trị, sự kiện bảo mật, yêu cầu dữ liệu" href="/admin/audit" />}
          {can(actor, "admin.support") && <ListItem icon={LifeBuoy} title="Hỗ trợ thành viên" href="/admin/support" />}
          {can(actor, "admin.broadcast") && <ListItem icon={Megaphone} title="Gửi thông báo chung" href="/admin/broadcast" />}
          {can(actor, "rewards.manage") && <ListItem icon={Gift} title="Quà tặng & đổi điểm" href="/admin/rewards" />}
          {can(actor, "admin.settings.manage") && <ListItem icon={Settings2} title="Cấu hình & bật/tắt tính năng" description="Điểm thưởng, hạng thành viên, tính năng" href="/admin/settings" />}
          {can(actor, "payments.view") && <ListItem icon={Database} title="Thanh toán" href="/payments/manage" />}
          <ListItem icon={ClipboardList} title="Phân quyền" description="Ai được làm gì" href="/more/roles" />
        </ListGroup>
        <div className="h-6" />
      </Section>
    </>
  );
}

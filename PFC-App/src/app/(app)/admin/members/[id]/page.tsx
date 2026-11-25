import Link from "next/link";
import { notFound } from "next/navigation";
import { requireMember, toActor } from "@/platform/auth/session";
import { memberDetail } from "@/platform/admin/console";
import { RESTRICTION_KINDS } from "@/platform/admin/restrictions";
import { DEPARTMENT_LABEL, ROLE_LABEL, can } from "@/platform/roles";
import { balanceOf, tierOf } from "@/modules/rewards/server/service";
import { AppHeader, Badge, Card, Section } from "@/ui";
import { AdjustPoints, LiftButton, RestrictForm } from "./MemberTools";

export const metadata = { title: "Chi tiết tài khoản" };
export const dynamic = "force-dynamic";

const vn = (iso: string) => new Date(iso).toLocaleString("vi-VN", { timeZone: "Asia/Ho_Chi_Minh", day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" });

/** IAM-A02 User detail: status, activity, restrictions, points. Role and lock stay on the account list (Chủ nhiệm). */
export default async function AdminMemberPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const me = await requireMember(`/admin/members/${id}`);
  const actor = toActor(me);
  if (!can(actor, "admin.members.view")) notFound();
  const m = await memberDetail(actor, id);
  if (!m) notFound();
  const [pts, tier] = await Promise.all([balanceOf(id), tierOf(id)]);
  const active = m.restrictions.filter((r) => r.active);
  return (
    <>
      <AppHeader back backFallback="/more/admin" title={m.name} />
      <Section>
        <Card className="space-y-1 text-[14px]">
          <p className="flex flex-wrap gap-1.5">
            <Badge tone="primary">{ROLE_LABEL[m.role]}</Badge>
            {m.department && <Badge tone="muted">{DEPARTMENT_LABEL[m.department]}</Badge>}
            {m.locked && <Badge tone="expense">Đã khóa</Badge>}
            {m.deleted && <Badge tone="muted">Đã xóa</Badge>}
            {!m.verified && <Badge tone="warning">Chưa xác thực email</Badge>}
            {active.length > 0 && <Badge tone="warning">{active.length} hạn chế</Badge>}
          </p>
          <p className="text-muted">{m.email}</p>
          <p className="text-muted">
            Tạo {vn(m.createdAt)} · {m.sessions} phiên đang mở{m.lastSeen && ` · hoạt động ${vn(m.lastSeen)}`}
          </p>
          <p className="text-muted">
            {m.stats.posts} bài viết · {m.stats.orders} đơn hàng · {m.stats.events} vé sự kiện ·{" "}
            <span className={m.stats.reportsAgainst ? "font-semibold text-expense" : ""}>{m.stats.reportsAgainst} báo cáo vi phạm</span>
          </p>
          <p className="text-muted">
            Điểm: <b className="text-ink">{pts.balance.toLocaleString("vi-VN")}</b> · tích lũy {pts.lifetime.toLocaleString("vi-VN")} · hạng {tier.label}
          </p>
          <Link href={`/members/${m.id}`} className="inline-block pt-1 font-semibold text-primary">
            Xem hồ sơ công khai
          </Link>
        </Card>
      </Section>

      <Section title="Hạn chế">
        {m.restrictions.length === 0 ? (
          <p className="text-[14px] text-muted">Chưa từng bị hạn chế.</p>
        ) : (
          <ul className="space-y-2">
            {m.restrictions.map((r) => (
              <li key={r.id} className="flex items-start justify-between gap-3 rounded-xl border border-line bg-surface px-4 py-3">
                <span className="min-w-0 text-[13px]">
                  <span className="block font-semibold text-ink">
                    {RESTRICTION_KINDS[r.kind]} {r.active ? <Badge tone="warning">Đang áp dụng</Badge> : <Badge tone="muted">{r.liftedAt ? "Đã gỡ" : "Hết hạn"}</Badge>}
                  </span>
                  <span className="block text-ink-2">{r.reason}</span>
                  <span className="block text-muted">
                    {vn(r.createdAt)}
                    {r.by && ` · ${r.by}`}
                    {r.until && ` · đến ${vn(r.until)}`}
                  </span>
                </span>
                {r.active && m.canRestrict && <LiftButton id={r.id} />}
              </li>
            ))}
          </ul>
        )}
        {m.canRestrict && !m.deleted && (
          <div className="mt-3">
            <RestrictForm memberId={m.id} kinds={Object.entries(RESTRICTION_KINDS)} />
          </div>
        )}
        <p className="mt-2 text-[12px] text-muted">Hạn chế có thời hạn và lý do; muốn chặn hẳn, Chủ nhiệm khóa tài khoản ở danh sách tài khoản.</p>
      </Section>

      {can(actor, "rewards.manage") && (
        <Section title="Điều chỉnh điểm thưởng">
          <AdjustPoints memberId={m.id} />
        </Section>
      )}

      <Section title="Hoạt động gần đây">
        {m.activity.length === 0 ? (
          <p className="text-[14px] text-muted">Chưa có.</p>
        ) : (
          <ul className="divide-y divide-line rounded-[var(--radius-card)] border border-line bg-surface text-[13px]">
            {m.activity.map((a, i) => (
              <li key={i} className="flex justify-between gap-3 px-4 py-2">
                <span className={a.result === "failure" ? "text-expense" : "text-ink"}>{a.action}</span>
                <span className="shrink-0 text-muted">{vn(a.at)}</span>
              </li>
            ))}
          </ul>
        )}
        <div className="h-6" />
      </Section>
    </>
  );
}

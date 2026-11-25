import { notFound } from "next/navigation";
import { requireMember } from "@/platform/auth/session";
import { formatVnd } from "@/lib/money";
import { daysBetween, formatDateVN, todayLocal } from "@/modules/finance/domain/dates";
import { getGoal } from "@/modules/finance/server/queries";
import { AppHeader, Card, Section } from "@/ui";
import { GoalActions } from "./GoalActions";

export const metadata = { title: "Chi tiết mục tiêu" };

/** FIN-15 Saving Goal Detail. */
export default async function GoalDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const me = await requireMember(`/finance/goals/${id}`);
  const g = await getGoal(me.id, id);
  if (!g) notFound();
  const pct = Math.min(100, (g.current / g.target) * 100);
  const left = daysBetween(todayLocal(), g.deadline);
  const remaining = Math.max(0, g.target - g.current);
  const perMonth = left > 0 ? remaining / Math.max(1, left / 30) : remaining;

  return (
    <>
      <AppHeader back backFallback="/finance/goals" title={g.name} />
      <Section>
        <Card className="flex flex-col items-center text-center">
          <div
            className="grid size-36 place-items-center rounded-full"
            style={{ background: `conic-gradient(var(--pfc-${pct >= 100 ? "income" : "primary"}) ${pct * 3.6}deg, var(--pfc-surface-2) 0)` }}
            role="img"
            aria-label={`Hoàn thành ${Math.floor(pct)}%`}
          >
            <span className="grid size-28 place-items-center rounded-full bg-surface">
              <span>
                <span className="block text-[26px] font-extrabold text-ink">{Math.floor(pct)}%</span>
                <span className="block text-[12px] text-muted">hoàn thành</span>
              </span>
            </span>
          </div>
          <p className="mt-4 text-[22px] font-extrabold text-ink">{formatVnd(g.current)}</p>
          <p className="text-[14px] text-muted">trên mục tiêu {formatVnd(g.target)}</p>
        </Card>
      </Section>
      <Section>
        <dl className="grid grid-cols-2 gap-3">
          {[
            ["Còn thiếu", formatVnd(remaining)],
            ["Hạn", formatDateVN(g.deadline)],
            ["Thời gian còn", left < 0 ? `Quá hạn ${-left} ngày` : `${left} ngày`],
            ["Cần để dành/tháng", remaining === 0 ? "—" : formatVnd(Math.ceil(perMonth))],
          ].map(([k, v]) => (
            <div key={k} className="rounded-2xl border border-line bg-surface p-3">
              <dt className="text-[12px] text-muted">{k}</dt>
              <dd className="text-[15px] font-bold text-ink">{v}</dd>
            </div>
          ))}
        </dl>
      </Section>
      <Section>
        <GoalActions id={g.id} current={g.current} />
      </Section>
    </>
  );
}

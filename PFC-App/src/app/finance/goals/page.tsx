import Link from "next/link";
import { Plus, Target } from "lucide-react";
import { requireMember } from "@/platform/auth/session";
import { formatVnd } from "@/lib/money";
import { daysBetween, formatDateVN, todayLocal } from "@/modules/finance/domain/dates";
import { listGoals } from "@/modules/finance/server/queries";
import { FilterChips } from "@/ui/FilterChips";
import { AppHeader, ButtonLink, Card, EmptyState, HeaderIconButton, Section } from "@/ui";
import { ProgressBar } from "@/ui/ProgressBar";

export const metadata = { title: "Mục tiêu tiết kiệm" };

/** FIN-13 Saving Goals (mockup 100: Đang thực hiện / Đã hoàn thành). */
export default async function GoalsPage({ searchParams }: { searchParams: Promise<Record<string, string>> }) {
  const me = await requireMember("/finance/goals");
  const tab = (await searchParams).tab === "done" ? "done" : "active";
  const goals = await listGoals(me.id);
  const today = todayLocal();
  const list = goals.filter((g) => (tab === "done" ? g.current >= g.target : g.current < g.target));

  return (
    <>
      <AppHeader
        back
        backFallback="/finance/more"
        title="Mục tiêu tài chính"
        actions={
          <HeaderIconButton label="Thêm mục tiêu" href="/finance/goals/new">
            <Plus size={24} />
          </HeaderIconButton>
        }
      />
      <div className="px-4">
        <FilterChips
          label="Trạng thái mục tiêu"
          value={tab}
          hrefFor={(v) => `/finance/goals?tab=${v}`}
          options={[
            { value: "active", label: "Đang thực hiện" },
            { value: "done", label: "Đã hoàn thành" },
          ]}
        />
      </div>
      {list.length === 0 ? (
        <EmptyState
          icon={Target}
          title={tab === "done" ? "Chưa hoàn thành mục tiêu nào" : "Chưa có mục tiêu"}
          description="Những mục tiêu lớn bắt đầu từ những bước nhỏ. Đặt mục tiêu đầu tiên của bạn."
          action={
            <ButtonLink href="/finance/goals/new" block>
              Thêm mục tiêu mới
            </ButtonLink>
          }
        />
      ) : (
        <Section>
          <ul className="space-y-3">
            {list.map((g) => {
              const pct = (g.current / g.target) * 100;
              const left = daysBetween(today, g.deadline);
              return (
                <li key={g.id}>
                  <Link href={`/finance/goals/${g.id}`} className="pressable block">
                    <Card>
                      <div className="flex items-start justify-between gap-2">
                        <span className="text-[16px] font-bold text-ink">{g.name}</span>
                        <span className="text-[14px] font-bold text-primary">{Math.floor(pct)}%</span>
                      </div>
                      <p className="mt-0.5 text-[13px] text-muted">
                        {formatVnd(g.current)} / {formatVnd(g.target)}
                      </p>
                      <ProgressBar className="mt-2.5" value={pct} tone={pct >= 100 ? "income" : "primary"} label={`Tiến độ ${g.name}`} />
                      <p className="mt-2 text-[12px] text-muted">
                        Hạn {formatDateVN(g.deadline)} ·{" "}
                        {pct >= 100 ? "Đã đạt" : left < 0 ? <span className="text-expense">Quá hạn {-left} ngày</span> : `còn ${left} ngày`}
                      </p>
                    </Card>
                  </Link>
                </li>
              );
            })}
          </ul>
          <ButtonLink href="/finance/goals/new" variant="secondary" block>
            <Plus size={18} /> Thêm mục tiêu mới
          </ButtonLink>
        </Section>
      )}
    </>
  );
}

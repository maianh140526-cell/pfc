import { PiggyBank, Plus } from "lucide-react";
import { requireMember } from "@/platform/auth/session";
import { formatVnd } from "@/lib/money";
import { formatDateVN, todayLocal } from "@/modules/finance/domain/dates";
import { listChallenges } from "@/modules/finance/server/queries";
import { AppHeader, Badge, ButtonLink, Card, EmptyState, HeaderIconButton, Section } from "@/ui";
import { ProgressBar } from "@/ui/ProgressBar";
import { ChallengeActions } from "./ChallengeActions";

export const metadata = { title: "Thử thách tiết kiệm" };

const STATUS = {
  active: { label: "Đang diễn ra", tone: "primary" },
  success: { label: "Thành công", tone: "income" },
  failed: { label: "Chưa đạt", tone: "expense" },
} as const;

/** FIN-16 Saving Challenge / FIN-17 Challenge Detail (combined, mobile list). */
export default async function ChallengesPage() {
  const me = await requireMember("/finance/challenges");
  const challenges = await listChallenges(me.id);
  const today = todayLocal();

  return (
    <>
      <AppHeader
        back
        backFallback="/finance/more"
        title="Thử thách tiết kiệm"
        actions={
          <HeaderIconButton label="Tạo thử thách" href="/finance/challenges/new">
            <Plus size={24} />
          </HeaderIconButton>
        }
      />
      {challenges.length === 0 ? (
        <EmptyState
          icon={PiggyBank}
          title="Chưa có thử thách nào"
          description="Thử thách tiết kiệm hoặc giới hạn chi tiêu trong một số ngày. Mỗi ngày check-in để PFC tính tiến độ từ giao dịch của bạn."
          action={
            <ButtonLink href="/finance/challenges/new" block>
              Tạo thử thách
            </ButtonLink>
          }
        />
      ) : (
        <Section>
          <ul className="space-y-3">
            {challenges.map((c) => {
              const s = STATUS[c.status];
              const isLimit = c.type === "spending_limit";
              const progressPct = Math.max(0, (c.progress / c.target) * 100);
              return (
                <li key={c.id}>
                  <Card>
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <p className="text-[16px] font-bold text-ink">{c.title}</p>
                        <p className="text-[12px] text-muted">
                          {isLimit ? "Giới hạn chi tiêu" : "Tiết kiệm"} · {c.durationDays} ngày · bắt đầu {formatDateVN(c.startDate)}
                        </p>
                      </div>
                      <Badge tone={s.tone}>{s.label}</Badge>
                    </div>
                    <div className="mt-3 flex items-baseline justify-between text-[13px]">
                      <span className="text-muted">{isLimit ? "Đã chi" : "Đã tiết kiệm"}</span>
                      <span className="font-bold text-ink">
                        {c.progress < 0 ? "−" : ""}
                        {formatVnd(Math.abs(c.progress))} / {formatVnd(c.target)}
                      </span>
                    </div>
                    <ProgressBar
                      className="mt-1.5"
                      value={progressPct}
                      tone={isLimit ? (progressPct > 100 ? "expense" : progressPct >= 80 ? "warning" : "income") : "primary"}
                      label={`Tiến độ ${c.title}`}
                    />
                    <div className="mt-2 flex items-center justify-between text-[13px]">
                      <span className="text-muted">
                        Check-in {c.checkedDays}/{c.durationDays} ngày
                      </span>
                    </div>
                    <ChallengeActions id={c.id} canCheckIn={c.status === "active" && c.lastCheckIn !== today} active={c.status === "active"} />
                  </Card>
                </li>
              );
            })}
          </ul>
        </Section>
      )}
    </>
  );
}

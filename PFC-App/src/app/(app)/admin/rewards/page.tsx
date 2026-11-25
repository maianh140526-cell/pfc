import Link from "next/link";
import { notFound } from "next/navigation";
import { requireMember, toActor } from "@/platform/auth/session";
import { can } from "@/platform/roles";
import { getSettings } from "@/platform/settings/service";
import { listRewards, redemptionQueue } from "@/modules/rewards/server/service";
import { AppHeader, Section } from "@/ui";
import { RedemptionDecision, RewardCatalog } from "./RewardsAdmin";

export const metadata = { title: "Quà tặng & đổi điểm" };
export const dynamic = "force-dynamic";

/** MEM-A Rewards catalog and redemption queue (rewards.manage). */
export default async function RewardsAdminPage() {
  const me = await requireMember("/admin/rewards");
  const actor = toActor(me);
  if (!can(actor, "rewards.manage")) notFound();
  const [rewards, queue, s] = await Promise.all([listRewards(true), redemptionQueue(actor), getSettings()]);
  return (
    <>
      <AppHeader back backFallback="/admin" title="Quà tặng & đổi điểm" />
      <Section title={`Yêu cầu đổi quà (${queue.length})`}>
        {queue.length === 0 ? (
          <p className="text-[14px] text-muted">Không có yêu cầu đang chờ.</p>
        ) : (
          <ul className="space-y-2">
            {queue.map((d) => (
              <li key={d.id} className="rounded-xl border border-line bg-surface p-3">
                <p className="text-[14px] font-semibold text-ink">{d.rewardTitle}</p>
                <p className="text-[12px] text-muted">
                  <Link href={`/admin/members/${d.memberId}`} className="font-semibold text-ink-2">
                    {d.memberName}
                  </Link>{" "}
                  · {d.cost.toLocaleString("vi-VN")} điểm · {new Date(d.createdAt).toLocaleString("vi-VN", { timeZone: "Asia/Ho_Chi_Minh" })}
                </p>
                <RedemptionDecision id={d.id} />
              </li>
            ))}
          </ul>
        )}
      </Section>
      <Section title="Danh mục quà">
        <RewardCatalog rewards={rewards} tiers={s.tiers.map((t) => [t.key, t.label])} />
        <p className="mt-2 pb-6 text-[12px] text-muted">Chỉ thêm quà và đối tác PFC đã thực sự thỏa thuận. Quy tắc cộng điểm và hạng: Cấu hình (Chủ nhiệm).</p>
      </Section>
    </>
  );
}

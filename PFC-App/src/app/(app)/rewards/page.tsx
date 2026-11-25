import { Gift, Medal } from "lucide-react";
import { requireMember, toActor } from "@/platform/auth/session";
import { publicUrl } from "@/platform/mail";
import { listRewards, myRedemptions, overview } from "@/modules/rewards/server/service";
import { RedeemButton, ReferralShare } from "@/modules/rewards/ui/RewardsClient";
import { AppHeader, Badge, Card, EmptyState, Section } from "@/ui";
import { ProgressBar } from "@/ui/ProgressBar";
import { cx } from "@/ui/cx";

export const metadata = { title: "Điểm thưởng" };
export const dynamic = "force-dynamic";

const KIND: Record<string, string> = { earn: "Cộng điểm", redeem: "Đổi quà", refund: "Hoàn điểm", adjust: "Điều chỉnh" };
const RED: Record<string, { label: string; tone: "warning" | "income" | "muted" }> = {
  requested: { label: "Chờ trao", tone: "warning" },
  fulfilled: { label: "Đã trao", tone: "income" },
  cancelled: { label: "Đã hủy", tone: "muted" },
};
const fmt = (n: number) => n.toLocaleString("vi-VN");

/** MEM-10…14 Points wallet, tiers, rewards, referrals (mockups 85, 103–106, 130–132). */
export default async function RewardsPage() {
  const me = await requireMember("/rewards");
  const actor = toActor(me);
  const [o, rewards, mine] = await Promise.all([overview(actor), listRewards(), myRedemptions(actor)]);
  const tierIndex = (key: string | null) => (key ? o.tiers.findIndex((t) => t.key === key) : -1);
  const myTier = tierIndex(o.tier.key);
  return (
    <>
      <AppHeader back backFallback="/more" title="Điểm thưởng" />
      <Section>
        <div className="rounded-[var(--radius-card)] bg-primary p-5 text-on-primary shadow-sheet">
          <p className="text-[13px] opacity-90">Điểm hiện có</p>
          <p className="text-[34px] leading-none font-extrabold">{fmt(o.balance)}</p>
          <p className="mt-2 inline-flex items-center gap-1 rounded-full bg-on-primary px-3 py-1 text-[13px] font-bold text-primary">
            <Medal size={16} /> Hạng {o.tier.label}
          </p>
          {o.next ? (
            <div className="mt-3">
              <ProgressBar value={o.progress * 100} label={`Tiến độ lên hạng ${o.next.label}`} />
              <p className="mt-1 text-[12px] opacity-90">
                Còn {fmt(o.next.min - o.lifetime)} điểm tích lũy để lên hạng {o.next.label}
              </p>
            </div>
          ) : (
            <p className="mt-2 text-[12px] opacity-90">Bạn đang ở hạng cao nhất.</p>
          )}
        </div>
      </Section>

      <Section title="Hạng thành viên">
        <ul className="space-y-2">
          {o.tiers.map((t, i) => (
            <li key={t.key} className={cx("rounded-xl border px-4 py-3", i === myTier ? "border-primary bg-primary-soft" : "border-line bg-surface")}>
              <p className="flex items-center justify-between text-[14px]">
                <span className="font-bold text-ink">{t.label}</span>
                <span className="text-muted">từ {fmt(t.min)} điểm</span>
              </p>
              {t.benefits && <p className="text-[13px] text-ink-2">{t.benefits}</p>}
            </li>
          ))}
        </ul>
        <p className="mt-2 text-[12px] text-muted">Hạng tính theo tổng điểm đã tích lũy; đổi quà không làm giảm hạng.</p>
      </Section>

      <Section title="Cách nhận điểm">
        <ul className="divide-y divide-line rounded-[var(--radius-card)] border border-line bg-surface">
          {o.rules.map((r) => (
            <li key={r.key} className="flex items-center justify-between gap-3 px-4 py-2.5 text-[14px]">
              <span className="text-ink">
                {r.label}
                {r.cap !== null && <span className="text-[12px] text-muted"> · tối đa {r.cap} lần/ngày</span>}
              </span>
              <b className="text-income">+{r.points}</b>
            </li>
          ))}
        </ul>
      </Section>

      <Section title="Giới thiệu bạn bè">
        <Card className="space-y-3">
          <p className="text-[14px] text-ink-2">
            Bạn được cộng điểm khi người được giới thiệu đăng ký qua link và hoàn tất hồ sơ. Đã giới thiệu: <b>{o.referrals}</b>
          </p>
          <p className="rounded-xl bg-surface-2 px-3 py-2 font-mono text-[13px] break-all text-ink">{`${publicUrl()}/r/${o.code}`}</p>
          <ReferralShare url={`${publicUrl()}/r/${o.code}`} />
        </Card>
      </Section>

      <Section title="Đổi quà">
        {rewards.length === 0 ? (
          <EmptyState icon={Gift} title="Chưa có quà" description="Ban điều hành PFC sẽ thêm quà tặng và ưu đãi đối tác tại đây." />
        ) : (
          <ul className="space-y-2">
            {rewards.map((r) => {
              const need = tierIndex(r.minTier);
              const tierLock = need > myTier ? o.tiers[need] : null;
              const soldOut = r.stock === 0;
              const short = o.balance < r.cost;
              return (
                <li key={r.id} className="rounded-[var(--radius-card)] border border-line bg-surface p-3">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="text-[15px] font-bold text-ink">{r.title}</p>
                      {r.partner && <p className="text-[12px] text-muted">{r.partner}</p>}
                      {r.description && <p className="mt-1 text-[13px] text-ink-2">{r.description}</p>}
                      <p className="mt-1 text-[12px] text-muted">
                        {r.stock !== null ? `Còn ${r.stock}` : "Không giới hạn"}
                        {tierLock && ` · từ hạng ${tierLock.label}`}
                      </p>
                    </div>
                    <span className="shrink-0 text-[16px] font-extrabold text-primary">{fmt(r.cost)} đ</span>
                  </div>
                  <div className="mt-2">
                    <RedeemButton
                      id={r.id}
                      title={r.title}
                      cost={r.cost}
                      disabled={soldOut || short || !!tierLock}
                      reason={soldOut ? "Hết quà" : tierLock ? `Cần hạng ${tierLock.label}` : short ? `Thiếu ${fmt(r.cost - o.balance)} điểm` : undefined}
                    />
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </Section>

      {mine.length > 0 && (
        <Section title="Quà đã đổi">
          <ul className="space-y-2">
            {mine.map((d) => (
              <li key={d.id} className="flex items-center justify-between gap-3 rounded-xl border border-line bg-surface px-4 py-3">
                <span className="min-w-0">
                  <span className="block truncate text-[14px] font-semibold text-ink">{d.rewardTitle}</span>
                  <span className="block text-[12px] text-muted">
                    {fmt(d.cost)} điểm{d.note && ` · ${d.note}`}
                  </span>
                </span>
                <Badge tone={RED[d.status].tone}>{RED[d.status].label}</Badge>
              </li>
            ))}
          </ul>
        </Section>
      )}

      <Section title="Lịch sử điểm">
        {o.history.length === 0 ? (
          <p className="text-[14px] text-muted">Chưa có giao dịch điểm.</p>
        ) : (
          <ul className="divide-y divide-line rounded-[var(--radius-card)] border border-line bg-surface">
            {o.history.map((h) => (
              <li key={h.id} className="flex items-center justify-between gap-3 px-4 py-2.5">
                <span className="min-w-0">
                  <span className="block truncate text-[14px] text-ink">{h.note || KIND[h.kind]}</span>
                  <span className="block text-[12px] text-muted">
                    {KIND[h.kind]} · {new Date(h.createdAt).toLocaleDateString("vi-VN", { timeZone: "Asia/Ho_Chi_Minh" })}
                  </span>
                </span>
                <b className={h.delta > 0 ? "text-income" : "text-expense"}>
                  {h.delta > 0 ? "+" : ""}
                  {fmt(h.delta)}
                </b>
              </li>
            ))}
          </ul>
        )}
        <div className="h-6" />
      </Section>
    </>
  );
}

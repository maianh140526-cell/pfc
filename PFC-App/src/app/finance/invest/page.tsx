import Link from "next/link";
import { TrendingUp } from "lucide-react";
import { requireMember } from "@/platform/auth/session";
import { formatVnd } from "@/lib/money";
import { HOLDING_KINDS, staleDays } from "@/modules/finance/domain/invest";
import { listHoldings } from "@/modules/finance/server/invest";
import { AppHeader, Card, EmptyState, FabLink, Section } from "@/ui";
import { ButtonLink } from "@/ui/Button";
import { DonutChart } from "@/ui/charts";

export const metadata = { title: "Đầu tư" };
export const dynamic = "force-dynamic";

const pct = (n: number | null) => (n === null ? "—" : `${n >= 0 ? "+" : ""}${n.toFixed(1)}%`);

/** FIN investment tracker (mockup 112). */
export default async function InvestPage() {
  const me = await requireMember("/finance/invest");
  const { holdings, summary } = await listHoldings(me.id);
  const head = summary.allocation.slice(0, 4);
  const tail = summary.allocation.slice(4).reduce((s, a) => s + a.value, 0);
  const slices = [
    ...head.map((a) => ({ key: a.kind, label: HOLDING_KINDS[a.kind], amount: a.value, share: a.share })),
    ...(tail > 0 ? [{ key: "other-fold", label: "Khác", amount: tail, share: tail / summary.value, isOther: true }] : []),
  ];
  return (
    <>
      <AppHeader back backFallback="/finance/more" title="Danh mục đầu tư" />
      {holdings.length === 0 ? (
        <EmptyState
          icon={TrendingUp}
          title="Chưa có tài sản nào"
          description="Ghi lại cổ phiếu, quỹ, vàng, tiền gửi… để theo dõi tổng giá trị và lãi/lỗ theo giá bạn cập nhật."
          action={<ButtonLink href="/finance/invest/new" block>Thêm tài sản</ButtonLink>}
        />
      ) : (
        <>
          <Section>
            <Card>
              <p className="text-[13px] text-muted">Tổng giá trị (theo giá bạn cập nhật)</p>
              <p className="text-[26px] font-extrabold text-ink">{formatVnd(summary.value)}</p>
              <p className={`text-[14px] font-semibold ${summary.gain >= 0 ? "text-income" : "text-expense"}`}>
                {summary.gain >= 0 ? "+" : ""}
                {formatVnd(summary.gain)} ({pct(summary.gainPct)}) · vốn {formatVnd(summary.cost)}
              </p>
            </Card>
          </Section>
          {slices.length > 0 && (
            <Section title="Phân bổ">
              <Card>
                <DonutChart slices={slices} centerLabel="Tài sản" centerValue={String(holdings.length)} />
              </Card>
            </Section>
          )}
          <Section title="Tài sản">
            <ul className="space-y-2 pb-4">
              {holdings.map((h) => {
                const stale = staleDays(h.priceUpdatedAt);
                return (
                  <li key={h.id}>
                    <Link href={`/finance/invest/${h.id}`} className="pressable flex items-center gap-3 rounded-[var(--radius-card)] border border-line bg-surface p-3">
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-[15px] font-bold text-ink">
                          {h.name}
                          {h.symbol && <span className="ml-1 text-[12px] font-semibold text-muted">{h.symbol}</span>}
                        </span>
                        <span className="block text-[12px] text-muted">
                          {HOLDING_KINDS[h.kind]} · {h.quantity.toLocaleString("vi-VN")} × {formatVnd(h.currentPrice)}
                        </span>
                        {stale >= 7 && <span className="block text-[12px] text-warning">Giá cập nhật {stale} ngày trước</span>}
                      </span>
                      <span className="text-right">
                        <span className="block text-[15px] font-bold text-ink">{formatVnd(h.value)}</span>
                        <span className={`block text-[12px] font-semibold ${h.gain >= 0 ? "text-income" : "text-expense"}`}>{pct(h.gainPct)}</span>
                      </span>
                    </Link>
                  </li>
                );
              })}
            </ul>
            <p className="pb-6 text-[12px] text-muted">Số liệu chỉ để bạn tự theo dõi, không phải tư vấn đầu tư.</p>
          </Section>
        </>
      )}
      <FabLink href="/finance/invest/new" label="Thêm tài sản" />
    </>
  );
}

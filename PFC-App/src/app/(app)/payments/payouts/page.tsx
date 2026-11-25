import { Wallet } from "lucide-react";
import { requireMember } from "@/platform/auth/session";
import { formatVnd } from "@/lib/money";
import { payeeBalance, payoutsOf } from "@/modules/payments/server/service";
import { vnTime } from "@/modules/payments/ui/format";
import { AppHeader, Badge, Card, EmptyState, Section } from "@/ui";

export const metadata = { title: "Chi trả" };
export const dynamic = "force-dynamic";

/** SELL-13/14 Seller / organizer balance and payouts. */
export default async function PayoutsPage() {
  const me = await requireMember("/payments/payouts");
  const [bal, list] = await Promise.all([payeeBalance(me.id), payoutsOf(me.id)]);
  const fee = Number(process.env.PFC_PLATFORM_FEE_BPS ?? 0) / 100;
  return (
    <>
      <AppHeader back backFallback="/payments" title="Tiền bán hàng / vé" />
      <Section>
        <div className="grid grid-cols-2 gap-2">
          <Card className="p-3">
            <p className="text-[12px] text-muted">Có thể chi trả</p>
            <p className="text-[18px] font-extrabold text-income">{formatVnd(bal.available)}</p>
          </Card>
          <Card className="p-3">
            <p className="text-[12px] text-muted">Đang giữ</p>
            <p className="text-[18px] font-extrabold text-ink">{formatVnd(bal.held)}</p>
          </Card>
          <Card className="p-3">
            <p className="text-[12px] text-muted">Đã nhận</p>
            <p className="text-[18px] font-extrabold text-ink">{formatVnd(bal.paidOut)}</p>
          </Card>
          <Card className="p-3">
            <p className="text-[12px] text-muted">Phí nền tảng</p>
            <p className="text-[18px] font-extrabold text-ink">{fee ? `${fee}%` : "0₫"}</p>
          </Card>
        </div>
        <p className="mt-3 text-[13px] text-muted">
          Tiền khách trả qua VNPAY được PFC giữ tới khi đơn hàng hoàn tất hoặc sự kiện kết thúc, rồi Chủ nhiệm chuyển khoản cho bạn. Khoản đang có yêu cầu hoàn tiền không được chi trả.
        </p>
      </Section>
      <Section title="Lịch sử chi trả">
        {list.length === 0 ? (
          <EmptyState icon={Wallet} title="Chưa có khoản chi trả" />
        ) : (
          <ul className="space-y-2 pb-4">
            {list.map((p) => (
              <li key={p.id} className="flex items-center justify-between gap-3 rounded-xl border border-line bg-surface px-4 py-3">
                <span>
                  <span className="block text-[15px] font-bold text-ink">{formatVnd(p.amount)}</span>
                  <span className="block text-[12px] text-muted">{p.paidAt ? `${vnTime(p.paidAt)} · ${p.note}` : `Tạo ${vnTime(p.createdAt)}`}</span>
                </span>
                <Badge tone={p.status === "paid" ? "income" : "warning"}>{p.status === "paid" ? "Đã chuyển" : "Đang xử lý"}</Badge>
              </li>
            ))}
          </ul>
        )}
      </Section>
    </>
  );
}

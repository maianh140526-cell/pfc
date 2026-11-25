import Link from "next/link";
import { Banknote, CreditCard, Inbox, ShieldCheck, Wallet } from "lucide-react";
import { requireMember, toActor } from "@/platform/auth/session";
import { can } from "@/platform/roles";
import { formatVnd } from "@/lib/money";
import { PAYMENT_STATUS_LABEL, myPayments, onlinePaymentEnabled, payeeBalance, refundInbox, type PaymentStatus } from "@/modules/payments/server/service";
import { PAY_TONE, vnTime } from "@/modules/payments/ui/format";
import { AppHeader, Badge, EmptyState, ListGroup, ListItem, Section } from "@/ui";
import { FilterChips } from "@/ui/FilterChips";

export const metadata = { title: "Thanh toán" };
export const dynamic = "force-dynamic";

const FILTERS: Record<string, string> = { "": "Tất cả", succeeded: "Thành công", pending: "Đang chờ", failed: "Thất bại", refunded: "Đã hoàn" };

/** PAY-07 Payment history (mockup 135) + entry points for payees and payment staff. */
export default async function PaymentsPage({ searchParams }: { searchParams: Promise<{ status?: string; error?: string }> }) {
  const sp = await searchParams;
  const me = await requireMember("/payments");
  const actor = toActor(me);
  const status = sp.status && sp.status in FILTERS ? sp.status : "";
  const [list, bal, inbox] = await Promise.all([myPayments(actor, status || undefined), payeeBalance(me.id), refundInbox(actor)]);
  const isPayee = bal.available + bal.held + bal.paidOut > 0;
  return (
    <>
      <AppHeader back backFallback="/more" title="Thanh toán" />
      {sp.error && (
        <Section>
          <p className="rounded-xl bg-expense-soft px-4 py-3 text-[14px] text-expense">Không xác minh được kết quả từ VNPAY. Nếu tiền đã bị trừ, giao dịch sẽ tự cập nhật trong ít phút.</p>
        </Section>
      )}
      {!onlinePaymentEnabled() && (
        <Section>
          <p className="rounded-xl bg-surface-2 px-4 py-3 text-[13px] text-muted">Thanh toán trực tuyến (VNPAY) chưa được bật trên máy chủ này.</p>
        </Section>
      )}
      <Section>
        <ListGroup>
          {(isPayee || inbox.length > 0) && <ListItem icon={Wallet} title="Tiền bán hàng / vé" description={`Có thể chi trả ${formatVnd(bal.available)} · đang giữ ${formatVnd(bal.held)}`} href="/payments/payouts" />}
          {inbox.length > 0 && <ListItem icon={Inbox} title="Yêu cầu hoàn tiền" description={`${inbox.length} yêu cầu đang chờ xử lý`} href="/payments/refunds" />}
          {can(actor, "payments.view") && <ListItem icon={ShieldCheck} title="Quản lý thanh toán" description="Giao dịch, hoàn tiền, chi trả cho người bán" href="/payments/manage" />}
        </ListGroup>
      </Section>
      <Section title="Lịch sử giao dịch">
        <FilterChips label="Lọc trạng thái" value={status} hrefFor={(v) => (v ? `/payments?status=${v}` : "/payments")} options={Object.entries(FILTERS).map(([value, label]) => ({ value, label }))} />
      </Section>
      {list.length === 0 ? (
        <EmptyState icon={CreditCard} title="Chưa có giao dịch" description="Các khoản thanh toán qua VNPAY cho đơn hàng và vé sự kiện sẽ hiện ở đây." />
      ) : (
        <ul className="space-y-2 px-4 pt-3 pb-4">
          {list.map((p) => (
            <li key={p.id}>
              <Link href={`/payments/${p.id}`} className="pressable flex items-center gap-3 rounded-[var(--radius-card)] border border-line bg-surface p-3">
                <span className="grid size-11 shrink-0 place-items-center rounded-2xl bg-primary-soft text-primary">
                  <Banknote size={22} />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-[14px] font-semibold text-ink">{p.description}</span>
                  <span className="block text-[12px] text-muted">{vnTime(p.createdAt)}</span>
                </span>
                <span className="text-right">
                  <span className="block text-[15px] font-bold text-ink">{formatVnd(p.amount)}</span>
                  <Badge tone={PAY_TONE[p.status as PaymentStatus]}>{PAYMENT_STATUS_LABEL[p.status as PaymentStatus]}</Badge>
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </>
  );
}

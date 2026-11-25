import Link from "next/link";
import { notFound } from "next/navigation";
import { requireMember, toActor } from "@/platform/auth/session";
import { can } from "@/platform/roles";
import { formatVnd } from "@/lib/money";
import { PAYMENT_STATUS_LABEL, adminOverview, refundInbox } from "@/modules/payments/server/service";
import { CreatePayoutButton, MarkPayoutPaid } from "@/modules/payments/ui/PaymentClient";
import { PAY_TONE, vnTime } from "@/modules/payments/ui/format";
import { AppHeader, Badge, Card, Section } from "@/ui";

export const metadata = { title: "Quản lý thanh toán" };
export const dynamic = "force-dynamic";

/** PAY-A01…A05 Payment staff: totals, transactions, open refunds, payouts. */
export default async function ManagePaymentsPage() {
  const me = await requireMember("/payments/manage");
  const actor = toActor(me);
  if (!can(actor, "payments.view")) notFound();
  const [o, refunds] = await Promise.all([adminOverview(actor), refundInbox(actor)]);
  const manage = can(actor, "payments.manage");
  return (
    <>
      <AppHeader back backFallback="/payments" title="Quản lý thanh toán" />
      <Section>
        <div className="grid grid-cols-3 gap-2">
          {[
            ["Đã thu", o.totals.succeeded],
            ["Đã hoàn", o.totals.refunded],
            ["Phí", o.totals.fees],
          ].map(([k, v]) => (
            <Card key={k} className="p-3">
              <p className="text-[12px] text-muted">{k}</p>
              <p className="text-[15px] font-extrabold text-ink">{formatVnd(Number(v))}</p>
            </Card>
          ))}
        </div>
      </Section>
      {refunds.length > 0 && (
        <Section title={`Hoàn tiền đang mở (${refunds.length})`} action={<Link href="/payments/refunds" className="text-[13px] font-semibold text-primary">Xem tất cả</Link>}>
          <ul className="space-y-1 text-[14px]">
            {refunds.slice(0, 5).map((r) => (
              <li key={r.id}>
                <Link href={`/payments/refunds/${r.id}`} className="flex justify-between gap-3 py-1">
                  <span className="truncate text-ink">{r.title}</span>
                  <span className="font-semibold text-ink">{formatVnd(r.amount)}</span>
                </Link>
              </li>
            ))}
          </ul>
        </Section>
      )}
      <Section title="Cần chi trả cho người bán / ban tổ chức">
        {o.payees.length === 0 ? (
          <p className="text-[14px] text-muted">Không có khoản đang giữ.</p>
        ) : (
          <ul className="space-y-2">
            {o.payees.map((p) => (
              <li key={p.payeeId} className="flex items-center justify-between gap-3 rounded-xl border border-line bg-surface px-4 py-3">
                <span>
                  <span className="block text-[14px] font-semibold text-ink">{p.name}</span>
                  <span className="block text-[12px] text-muted">
                    Sẵn sàng {formatVnd(p.available)} · đang giữ {formatVnd(p.held)}
                  </span>
                </span>
                {manage && p.available > 0 && <CreatePayoutButton payeeId={p.payeeId} />}
              </li>
            ))}
          </ul>
        )}
      </Section>
      {o.pendingPayouts.length > 0 && (
        <Section title="Lệnh chi đang chờ chuyển khoản">
          <ul className="space-y-2">
            {o.pendingPayouts.map((p) => (
              <li key={p.id} className="rounded-xl border border-line bg-surface px-4 py-3">
                <p className="flex justify-between text-[14px]">
                  <span className="font-semibold text-ink">{p.payee}</span>
                  <span className="font-bold text-ink">{formatVnd(p.amount)}</span>
                </p>
                <p className="text-[12px] text-muted">Tạo {vnTime(p.createdAt)}</p>
                {manage && <MarkPayoutPaid id={p.id} />}
              </li>
            ))}
          </ul>
        </Section>
      )}
      <Section title="Giao dịch gần đây">
        <ul className="divide-y divide-line overflow-hidden rounded-[var(--radius-card)] border border-line bg-surface">
          {o.payments.map((p) => (
            <li key={p.id}>
              <Link href={`/payments/${p.id}`} className="flex items-center gap-3 px-4 py-3">
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-[14px] font-semibold text-ink">{p.description}</span>
                  <span className="block text-[12px] text-muted">
                    {p.payer} · {vnTime(p.createdAt)}
                  </span>
                </span>
                <span className="text-right">
                  <span className="block text-[14px] font-bold text-ink">{formatVnd(p.amount)}</span>
                  <Badge tone={PAY_TONE[p.status]}>{PAYMENT_STATUS_LABEL[p.status]}</Badge>
                </span>
              </Link>
            </li>
          ))}
          {o.payments.length === 0 && <li className="px-4 py-3 text-[14px] text-muted">Chưa có giao dịch.</li>}
        </ul>
        <div className="h-6" />
      </Section>
    </>
  );
}

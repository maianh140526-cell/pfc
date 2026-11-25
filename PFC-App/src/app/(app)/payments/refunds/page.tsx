import Link from "next/link";
import { Inbox } from "lucide-react";
import { requireMember, toActor } from "@/platform/auth/session";
import { formatVnd } from "@/lib/money";
import { REFUND_REASONS, REFUND_STATUS_LABEL, refundInbox } from "@/modules/payments/server/service";
import { REFUND_TONE, vnTime } from "@/modules/payments/ui/format";
import { AppHeader, Badge, EmptyState } from "@/ui";

export const metadata = { title: "Yêu cầu hoàn tiền" };
export const dynamic = "force-dynamic";

/** SELL-12 / EVT-A Refund requests waiting for this payee (all, for payment staff). */
export default async function RefundInboxPage() {
  const me = await requireMember("/payments/refunds");
  const list = await refundInbox(toActor(me));
  return (
    <>
      <AppHeader back backFallback="/payments" title="Yêu cầu hoàn tiền" />
      {list.length === 0 ? (
        <EmptyState icon={Inbox} title="Không có yêu cầu đang chờ" />
      ) : (
        <ul className="space-y-2 px-4 pb-4">
          {list.map((r) => (
            <li key={r.id}>
              <Link href={`/payments/refunds/${r.id}`} className="pressable block rounded-[var(--radius-card)] border border-line bg-surface p-3">
                <span className="flex items-center justify-between gap-2">
                  <span className="truncate text-[14px] font-bold text-ink">{r.title}</span>
                  <Badge tone={REFUND_TONE[r.status]}>{REFUND_STATUS_LABEL[r.status]}</Badge>
                </span>
                <span className="mt-1 block text-[13px] text-ink-2">
                  {formatVnd(r.amount)} · {REFUND_REASONS[r.reason]}
                </span>
                <span className="block text-[12px] text-muted">{vnTime(r.createdAt)}</span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </>
  );
}

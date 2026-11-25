import Link from "next/link";
import { formatVnd } from "@/lib/money";
import { Badge } from "@/ui";
import { ORDER_STATUS_LABEL, ORDER_TONE } from "../domain/orders";
import type { OrderSummary } from "../server/service";

export function OrderList({ orders, role }: { orders: OrderSummary[]; role: "buyer" | "seller" }) {
  return (
    <ul className="space-y-3">
      {orders.map((o) => (
        <li key={o.id}>
          <Link href={`/market/orders/${o.id}`} className="pressable block rounded-[var(--radius-card)] border border-line bg-surface p-4 shadow-card">
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <p className="text-[13px] font-bold text-ink">#{o.code}</p>
                <p className="text-[12px] text-muted">
                  {new Date(o.createdAt).toLocaleDateString("vi-VN")} · {role === "buyer" ? o.counterpart : `Người mua: ${o.counterpart}`}
                </p>
              </div>
              <Badge tone={ORDER_TONE[o.status]}>{ORDER_STATUS_LABEL[o.status]}</Badge>
            </div>
            <p className="mt-2 line-clamp-1 text-[14px] text-ink-2">
              {o.firstTitle}
              {o.itemCount > 1 ? ` và ${o.itemCount - 1} sản phẩm khác` : ""}
            </p>
            <p className="mt-1 flex justify-between text-[14px]">
              <span className="text-muted">{o.paymentStatus === "paid" ? "Đã thanh toán" : "Chưa thanh toán"}</span>
              <b className="text-ink">{formatVnd(o.total)}</b>
            </p>
          </Link>
        </li>
      ))}
    </ul>
  );
}

"use client";

import Link from "next/link";
import { Minus, Plus, Store, Trash2 } from "lucide-react";
import { formatVnd } from "@/lib/money";
import { setCartQtyAction } from "@/modules/market/server/actions";
import { useAction } from "@/ui/use-action";

type Item = { listingId: string; title: string; price: number; qty: number; stock: number | null; available: boolean };

export function CartLines({ groups }: { groups: Array<{ sellerId: string; shopName: string; total: number; items: Item[] }> }) {
  const a = useAction();
  return (
    <div className="space-y-3 px-4">
      {a.error && <p className="text-[13px] text-expense">{a.error}</p>}
      {groups.map((g) => (
        <section key={g.sellerId} className="overflow-hidden rounded-[var(--radius-card)] border border-line bg-surface">
          <h2 className="flex items-center gap-2 border-b border-line px-4 py-2.5 text-[14px] font-bold text-ink">
            <Store size={16} className="text-primary" /> {g.shopName}
          </h2>
          <ul className="divide-y divide-line">
            {g.items.map((i) => (
              <li key={i.listingId} className="flex items-center gap-3 px-4 py-3">
                <div className="min-w-0 flex-1">
                  <Link href={`/market/p/${i.listingId}`} className="line-clamp-2 text-[14px] font-semibold text-ink">
                    {i.title}
                  </Link>
                  <p className="text-[14px] font-bold text-primary">{formatVnd(i.price)}</p>
                  {!i.available && <p className="text-[12px] text-expense">Không còn bán</p>}
                </div>
                <div className="flex items-center rounded-full border border-line">
                  <button
                    type="button"
                    aria-label={i.qty === 1 ? "Xóa khỏi giỏ" : "Giảm"}
                    disabled={a.pending}
                    onClick={() => a.run(() => setCartQtyAction(i.listingId, i.qty - 1))}
                    className="grid size-9 place-items-center text-ink-2"
                  >
                    {i.qty === 1 ? <Trash2 size={15} className="text-expense" /> : <Minus size={15} />}
                  </button>
                  <span className="w-6 text-center text-[14px] font-bold">{i.qty}</span>
                  <button
                    type="button"
                    aria-label="Tăng"
                    disabled={a.pending || (i.stock !== null && i.qty >= i.stock)}
                    onClick={() => a.run(() => setCartQtyAction(i.listingId, i.qty + 1))}
                    className="grid size-9 place-items-center text-ink-2 disabled:opacity-30"
                  >
                    <Plus size={15} />
                  </button>
                </div>
              </li>
            ))}
          </ul>
          <p className="border-t border-line px-4 py-2 text-right text-[13px] text-muted">
            Tạm tính: <b className="text-ink">{formatVnd(g.total)}</b>
          </p>
        </section>
      ))}
    </div>
  );
}

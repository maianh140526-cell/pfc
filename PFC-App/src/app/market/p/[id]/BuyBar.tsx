"use client";

import { useRouter } from "next/navigation";
import { Heart, Minus, Plus } from "lucide-react";
import { useState } from "react";
import { addToCartAction, toggleFavoriteAction } from "@/modules/market/server/actions";
import { Button } from "@/ui";
import { useAction } from "@/ui/use-action";
import { cx } from "@/ui/cx";

/** Sticky buy bar (mockup 59: Thêm vào giỏ · Mua ngay). */
export function BuyBar({ listingId, soldOut, maxQty, favorite, signedIn }: { listingId: string; soldOut: boolean; maxQty: number; favorite: boolean; signedIn: boolean }) {
  const router = useRouter();
  const [qty, setQty] = useState(1);
  const [added, setAdded] = useState(false);
  const a = useAction();
  const fav = useAction();
  const login = () => router.push(`/login?next=/market/p/${listingId}`);

  return (
    <>
      <div className="h-24" aria-hidden="true" />
      <div className="fixed-in-canvas bottom-[calc(var(--tabbar-h)+var(--safe-bottom))] z-30 border-t border-line bg-surface/95 px-4 py-3 backdrop-blur-md">
        {a.error && <p className="mb-2 text-[13px] text-expense">{a.error}</p>}
        {added && !a.error && <p className="mb-2 text-[13px] font-semibold text-income">Đã thêm vào giỏ hàng.</p>}
        <div className="flex items-center gap-2">
          <button
            type="button"
            aria-label={favorite ? "Bỏ yêu thích" : "Yêu thích"}
            aria-pressed={favorite}
            onClick={() => (signedIn ? fav.run(() => toggleFavoriteAction(listingId)) : login())}
            className={cx("pressable grid size-12 shrink-0 place-items-center rounded-full border border-line", favorite ? "text-expense" : "text-muted")}
          >
            <Heart size={22} fill={favorite ? "currentColor" : "none"} />
          </button>
          <div className="flex items-center rounded-full border border-line" aria-label="Số lượng">
            <button type="button" aria-label="Giảm" disabled={qty <= 1} onClick={() => setQty(qty - 1)} className="grid size-10 place-items-center text-ink-2 disabled:opacity-30">
              <Minus size={16} />
            </button>
            <span className="w-6 text-center text-[15px] font-bold text-ink">{qty}</span>
            <button type="button" aria-label="Tăng" disabled={qty >= Math.min(maxQty, 99)} onClick={() => setQty(qty + 1)} className="grid size-10 place-items-center text-ink-2 disabled:opacity-30">
              <Plus size={16} />
            </button>
          </div>
          <Button
            variant="secondary"
            className="min-h-12 flex-1 px-2 text-[14px]"
            disabled={soldOut || a.pending}
            onClick={() => (signedIn ? a.run(() => addToCartAction(listingId, qty), () => setAdded(true)) : login())}
          >
            Thêm vào giỏ
          </Button>
          <Button
            className="min-h-12 flex-1 px-2 text-[14px]"
            disabled={soldOut || a.pending}
            onClick={() => (signedIn ? a.run(() => addToCartAction(listingId, qty), () => router.push("/market/cart")) : login())}
          >
            {soldOut ? "Hết hàng" : "Mua ngay"}
          </Button>
        </div>
      </div>
    </>
  );
}

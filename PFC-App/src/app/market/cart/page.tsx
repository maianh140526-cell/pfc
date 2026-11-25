import { ShoppingCart } from "lucide-react";
import { requireMember, toActor } from "@/platform/auth/session";
import { formatVnd } from "@/lib/money";
import { getCart } from "@/modules/market/server/service";
import { AppHeader, ButtonLink, Card, EmptyState, Section } from "@/ui";
import { CartLines } from "./CartLines";

export const metadata = { title: "Giỏ hàng" };
export const dynamic = "force-dynamic";

/** MKT-11 Cart (mockup 60). Grouped by seller: each group becomes its own order. */
export default async function CartPage() {
  const me = await requireMember("/market/cart");
  const cart = await getCart(toActor(me));
  return (
    <>
      <AppHeader title="Giỏ hàng" backHref="/market" />
      {cart.lines.length === 0 ? (
        <EmptyState
          icon={ShoppingCart}
          title="Giỏ hàng trống"
          action={
            <ButtonLink href="/market" block>
              Khám phá sản phẩm
            </ButtonLink>
          }
        />
      ) : (
        <>
          <CartLines groups={cart.groups.map((g) => ({ sellerId: g.sellerId, shopName: g.shopName, total: g.total, items: g.items.map((i) => ({ ...i })) }))} />
          {cart.problems.length > 0 && (
            <Section>
              <Card className="border-expense bg-expense-soft text-[14px] text-expense">
                {cart.problems.map((p) => (
                  <p key={p}>{p}</p>
                ))}
              </Card>
            </Section>
          )}
          <Section>
            <Card>
              <div className="flex items-baseline justify-between">
                <span className="text-[15px] text-ink-2">Tổng cộng</span>
                <span className="text-[22px] font-extrabold text-primary">{formatVnd(cart.total)}</span>
              </div>
              {cart.groups.length > 1 && <p className="mt-1 text-[12px] text-muted">Đơn sẽ được tách theo {cart.groups.length} người bán.</p>}
              <div className="mt-3">
                {cart.problems.length > 0 ? (
                  <p className="text-center text-[13px] text-muted">Sửa các mục ở trên để thanh toán.</p>
                ) : (
                  <ButtonLink href="/market/checkout" block>
                    Thanh toán
                  </ButtonLink>
                )}
              </div>
            </Card>
          </Section>
        </>
      )}
    </>
  );
}

import { redirect } from "next/navigation";
import { requireMember, toActor } from "@/platform/auth/session";
import { getCart } from "@/modules/market/server/service";
import { onlinePaymentEnabled } from "@/modules/payments/server/service";
import { AppHeader } from "@/ui";
import { CheckoutForm } from "./CheckoutForm";

export const metadata = { title: "Thanh toán" };
export const dynamic = "force-dynamic";

/** MKT-12 Checkout + PAY-01 payment method (mockup 61 / 62). */
export default async function CheckoutPage() {
  const me = await requireMember("/market/checkout");
  const cart = await getCart(toActor(me));
  if (cart.lines.length === 0 || cart.problems.length > 0) redirect("/market/cart");
  return (
    <>
      <AppHeader back backFallback="/market/cart" title="Thanh toán" />
      <CheckoutForm
        vnpay={onlinePaymentEnabled()}
        defaultName={me.fullName}
        needsAddress={cart.needsAddress}
        total={cart.total}
        groups={cart.groups.map((g) => ({ shopName: g.shopName, total: g.total, items: g.items.map((i) => ({ title: i.title, qty: i.qty, price: i.price })) }))}
      />
    </>
  );
}

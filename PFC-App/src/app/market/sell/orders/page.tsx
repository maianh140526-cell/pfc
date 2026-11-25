import { ReceiptText } from "lucide-react";
import { requireMember, toActor } from "@/platform/auth/session";
import { sellerOrders } from "@/modules/market/server/service";
import { OrderList } from "@/modules/market/ui/OrderList";
import { AppHeader, EmptyState } from "@/ui";
import { FilterChips } from "@/ui/FilterChips";

export const metadata = { title: "Đơn bán" };
export const dynamic = "force-dynamic";

/** SELL-10 Seller Orders. */
export default async function SellerOrdersPage({ searchParams }: { searchParams: Promise<{ tab?: string }> }) {
  const { tab } = await searchParams;
  const me = await requireMember("/market/sell/orders");
  const all = await sellerOrders(toActor(me));
  const open = (s: string) => ["placed", "confirmed", "shipping", "delivered"].includes(s);
  const key = tab === "done" ? "done" : tab === "all" ? "all" : "open";
  const orders = all.filter((o) => (key === "all" ? true : key === "open" ? open(o.status) : !open(o.status)));
  return (
    <>
      <AppHeader back backFallback="/market/sell" title="Đơn bán" />
      <div className="px-4">
        <FilterChips
          label="Trạng thái"
          value={key}
          hrefFor={(t) => `/market/sell/orders?tab=${t}`}
          options={[
            { value: "open", label: `Cần xử lý (${all.filter((o) => open(o.status)).length})` },
            { value: "done", label: "Đã xong / hủy" },
            { value: "all", label: "Tất cả" },
          ]}
        />
      </div>
      {orders.length === 0 ? (
        <EmptyState icon={ReceiptText} title="Không có đơn" />
      ) : (
        <div className="px-4 pt-3">
          <OrderList orders={orders} role="seller" />
        </div>
      )}
    </>
  );
}

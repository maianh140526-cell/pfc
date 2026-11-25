import { CheckCircle2, ReceiptText } from "lucide-react";
import { requireMember, toActor } from "@/platform/auth/session";
import { myOrders } from "@/modules/market/server/service";
import { OrderList } from "@/modules/market/ui/OrderList";
import { AppHeader, ButtonLink, Card, EmptyState, Section } from "@/ui";
import { FilterChips } from "@/ui/FilterChips";

export const metadata = { title: "Đơn mua" };
export const dynamic = "force-dynamic";

const TABS = {
  all: { label: "Tất cả", match: () => true },
  open: { label: "Đang xử lý", match: (s: string) => ["placed", "confirmed", "shipping", "delivered"].includes(s) },
  completed: { label: "Hoàn tất", match: (s: string) => s === "completed" },
  cancelled: { label: "Đã hủy", match: (s: string) => s === "cancelled" },
} as const;

/** MKT-15 Order Confirmation (after checkout) · MKT-16 My Orders (mockup 64 / 65). */
export default async function OrdersPage({ searchParams }: { searchParams: Promise<{ tab?: string; placed?: string }> }) {
  const { tab, placed } = await searchParams;
  const me = await requireMember("/market/orders");
  const key = (tab && tab in TABS ? tab : "all") as keyof typeof TABS;
  const orders = (await myOrders(toActor(me))).filter((o) => TABS[key].match(o.status));
  return (
    <>
      <AppHeader title="Đơn mua" backHref="/market" />
      {placed && (
        <Section>
          <Card className="flex items-center gap-3 border-income bg-income-soft">
            <CheckCircle2 size={28} className="shrink-0 text-income" />
            <p className="text-[14px] text-ink">
              <b>Đặt hàng thành công!</b> {Number(placed) > 1 ? `Đã tạo ${placed} đơn theo từng người bán.` : "Người bán sẽ xác nhận đơn sớm."}
            </p>
          </Card>
        </Section>
      )}
      <div className="px-4 pt-2">
        <FilterChips label="Trạng thái" value={key} hrefFor={(t) => `/market/orders?tab=${t}`} options={Object.entries(TABS).map(([value, t]) => ({ value, label: t.label }))} />
      </div>
      {orders.length === 0 ? (
        <EmptyState
          icon={ReceiptText}
          title="Chưa có đơn hàng"
          action={
            <ButtonLink href="/market" block>
              Mua sắm ngay
            </ButtonLink>
          }
        />
      ) : (
        <div className="px-4 pt-3">
          <OrderList orders={orders} role="buyer" />
        </div>
      )}
    </>
  );
}

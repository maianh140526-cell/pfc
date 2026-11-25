import { notFound } from "next/navigation";
import { Store } from "lucide-react";
import { getSeller, listPublished } from "@/modules/market/server/service";
import { ListingCard } from "@/modules/market/ui/ListingCard";
import { AppHeader, Card, EmptyState, Section } from "@/ui";

export const dynamic = "force-dynamic";

/** MKT-09 Seller Profile / MKT-10 Seller Store. */
export default async function ShopPage({ params }: { params: Promise<{ sellerId: string }> }) {
  const { sellerId } = await params;
  const s = await getSeller(sellerId);
  if (!s || s.status !== "approved") notFound();
  const items = await listPublished({ sellerId });
  return (
    <>
      <AppHeader back backFallback="/market" title={s.shopName} />
      <Section>
        <Card className="flex items-start gap-3">
          <span className="grid size-14 shrink-0 place-items-center rounded-full bg-primary-soft text-primary">
            <Store size={26} />
          </span>
          <div className="min-w-0">
            <p className="text-[17px] font-bold text-ink">{s.shopName}</p>
            <p className="text-[13px] text-muted">Chủ cửa hàng: {s.memberName}</p>
            {s.bio && <p className="mt-1 text-[14px] text-ink-2">{s.bio}</p>}
          </div>
        </Card>
      </Section>
      <Section title={`Sản phẩm (${items.length})`}>
        {items.length === 0 ? (
          <EmptyState icon={Store} title="Cửa hàng chưa có sản phẩm" />
        ) : (
          <ul className="grid grid-cols-2 gap-3">
            {items.map((l) => (
              <li key={l.id}>
                <ListingCard l={l} />
              </li>
            ))}
          </ul>
        )}
      </Section>
    </>
  );
}

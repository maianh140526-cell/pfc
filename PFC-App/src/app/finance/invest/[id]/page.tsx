import { notFound } from "next/navigation";
import { requireMember } from "@/platform/auth/session";
import { getHolding } from "@/modules/finance/server/invest";
import { HoldingForm } from "@/modules/finance/ui/HoldingForm";
import { AppHeader } from "@/ui";

export const metadata = { title: "Sửa tài sản" };
export const dynamic = "force-dynamic";

export default async function EditHoldingPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const me = await requireMember(`/finance/invest/${id}`);
  const h = await getHolding(me.id, id);
  if (!h) notFound();
  return (
    <>
      <AppHeader back backFallback="/finance/invest" title={h.name} />
      <HoldingForm
        id={h.id}
        initial={{ name: h.name, symbol: h.symbol, kind: h.kind, quantity: String(h.quantity), avgCost: String(h.avgCost), currentPrice: String(h.currentPrice), note: h.note }}
      />
    </>
  );
}

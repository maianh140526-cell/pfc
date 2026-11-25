import { notFound } from "next/navigation";
import { requireMember, toActor } from "@/platform/auth/session";
import { PLACE_CATEGORIES, PRICE_LEVEL, getPlace } from "@/modules/finance/server/places";
import { PlaceForm } from "@/modules/finance/ui/PlaceForm";
import { AppHeader } from "@/ui";

export const metadata = { title: "Sửa địa điểm" };
export const dynamic = "force-dynamic";

export default async function EditPlacePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const me = await requireMember(`/finance/places/${id}/edit`);
  const p = await getPlace(toActor(me), id);
  if (!p || !p.isAuthor) notFound();
  return (
    <>
      <AppHeader back backFallback={`/finance/places/${id}`} title="Sửa địa điểm" />
      <PlaceForm
        id={id}
        categories={Object.entries(PLACE_CATEGORIES)}
        prices={Object.entries(PRICE_LEVEL)}
        initial={{ name: p.name, category: p.category, address: p.address, area: p.area, priceLevel: String(p.priceLevel), description: p.description, cover: p.coverUrl ? [p.coverUrl] : [] }}
      />
    </>
  );
}

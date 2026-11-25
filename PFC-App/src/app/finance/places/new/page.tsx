import { requireMember } from "@/platform/auth/session";
import { PLACE_CATEGORIES, PRICE_LEVEL } from "@/modules/finance/server/places";
import { PlaceForm } from "@/modules/finance/ui/PlaceForm";
import { AppHeader } from "@/ui";

export const metadata = { title: "Chia sẻ địa điểm" };

/** FIN-30 Add place. */
export default async function NewPlacePage() {
  await requireMember("/finance/places/new");
  return (
    <>
      <AppHeader back backFallback="/finance/places" title="Chia sẻ địa điểm" />
      <PlaceForm categories={Object.entries(PLACE_CATEGORIES)} prices={Object.entries(PRICE_LEVEL)} />
    </>
  );
}

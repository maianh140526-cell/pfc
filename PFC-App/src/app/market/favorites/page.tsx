import { Heart } from "lucide-react";
import { requireMember, toActor } from "@/platform/auth/session";
import { listFavorites } from "@/modules/market/server/service";
import { ListingCard } from "@/modules/market/ui/ListingCard";
import { AppHeader, EmptyState } from "@/ui";

export const metadata = { title: "Yêu thích" };
export const dynamic = "force-dynamic";

export default async function FavoritesPage() {
  const me = await requireMember("/market/favorites");
  const items = await listFavorites(toActor(me));
  return (
    <>
      <AppHeader back backFallback="/market/more" title="Sản phẩm yêu thích" />
      {items.length === 0 ? (
        <EmptyState icon={Heart} title="Chưa có sản phẩm yêu thích" description="Chạm biểu tượng trái tim trên trang sản phẩm để lưu lại." />
      ) : (
        <ul className="grid grid-cols-2 gap-3 px-4">
          {items.map((l) => (
            <li key={l.id}>
              <ListingCard l={l} />
            </li>
          ))}
        </ul>
      )}
    </>
  );
}

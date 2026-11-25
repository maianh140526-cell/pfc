import Link from "next/link";
import { MapPin, Star } from "lucide-react";
import { currentMember, toActor } from "@/platform/auth/session";
import { PLACE_CATEGORIES, PRICE_LEVEL, listPlaces } from "@/modules/finance/server/places";
import { AppHeader, EmptyState, FabLink } from "@/ui";
import { FilterChips } from "@/ui/FilterChips";
import { SearchBox } from "@/ui/SearchBox";

export const metadata = { title: "Ngon – Bổ – Rẻ" };
export const dynamic = "force-dynamic";

/** FIN-26/27 Places discovery (mockups 32–33). */
export default async function PlacesPage({ searchParams }: { searchParams: Promise<{ category?: string; q?: string; price?: string; sort?: string; saved?: string }> }) {
  const sp = await searchParams;
  const me = await currentMember();
  const places = await listPlaces(me ? toActor(me) : null, { category: sp.category, q: sp.q?.slice(0, 80), price: sp.price, sort: sp.sort === "new" ? "new" : "top", saved: sp.saved === "1" && !!me });
  const qs = (patch: Record<string, string | undefined>) => {
    const p = new URLSearchParams();
    for (const [k, v] of Object.entries({ category: sp.category, q: sp.q, price: sp.price, sort: sp.sort, saved: sp.saved, ...patch })) if (v) p.set(k, v);
    return `/finance/places?${p.toString()}`;
  };
  return (
    <>
      <AppHeader back backFallback="/finance/more" title="Ngon – Bổ – Rẻ" subtitle="Địa điểm tiết kiệm do thành viên chia sẻ" />
      <div className="space-y-3 px-4">
        <SearchBox placeholder="Tìm quán, địa chỉ, khu vực…" />
        <FilterChips
          label="Loại"
          value={sp.category && sp.category in PLACE_CATEGORIES ? sp.category : ""}
          hrefFor={(c) => qs({ category: c || undefined })}
          options={[{ value: "", label: "Tất cả" }, ...Object.entries(PLACE_CATEGORIES).map(([value, label]) => ({ value, label }))]}
        />
        <FilterChips
          label="Sắp xếp"
          value={sp.saved === "1" ? "saved" : sp.sort === "new" ? "new" : sp.price ? `p${sp.price}` : "top"}
          hrefFor={(v) => (v === "saved" ? qs({ saved: "1", sort: undefined, price: undefined }) : v === "new" ? qs({ sort: "new", saved: undefined, price: undefined }) : v.startsWith("p") ? qs({ price: v.slice(1), saved: undefined, sort: undefined }) : qs({ sort: undefined, saved: undefined, price: undefined }))}
          options={[{ value: "top", label: "Đánh giá cao" }, { value: "new", label: "Mới nhất" }, { value: "p1", label: PRICE_LEVEL[1] }, ...(me ? [{ value: "saved", label: "Đã lưu" }] : [])]}
        />
      </div>
      {places.length === 0 ? (
        <EmptyState icon={MapPin} title="Chưa có địa điểm" description="Biết quán ngon, rẻ, góc học yên tĩnh? Chia sẻ để mọi người cùng tiết kiệm." />
      ) : (
        <ul className="space-y-2 px-4 pt-3 pb-4">
          {places.map((p) => (
            <li key={p.id}>
              <Link href={`/finance/places/${p.id}`} className="pressable flex gap-3 rounded-[var(--radius-card)] border border-line bg-surface p-3">
                <span className="grid size-16 shrink-0 place-items-center overflow-hidden rounded-2xl bg-primary-soft text-primary">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  {p.coverUrl ? <img src={p.coverUrl} alt="" className="size-full object-cover" loading="lazy" /> : <MapPin size={26} />}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-[15px] font-bold text-ink">{p.name}</span>
                  <span className="block truncate text-[12px] text-muted">{p.area ? `${p.area} · ` : ""}{p.address}</span>
                  <span className="mt-1 flex items-center gap-2 text-[12px]">
                    <span className="inline-flex items-center gap-0.5 font-semibold text-ink">
                      <Star size={13} className="fill-warning text-warning" /> {p.rating ?? "—"} ({p.reviews})
                    </span>
                    <span className="text-muted">{PLACE_CATEGORIES[p.category]}</span>
                    <span className="text-muted">{PRICE_LEVEL[p.priceLevel]}</span>
                  </span>
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}
      {me && <FabLink href="/finance/places/new" label="Chia sẻ địa điểm" />}
    </>
  );
}

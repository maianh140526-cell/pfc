import Link from "next/link";
import { BookOpen, GraduationCap, Laptop, Package, Shirt, Sparkles, Star, Ticket, Wrench, type LucideIcon } from "lucide-react";
import { formatVnd } from "@/lib/money";
import type { Listing } from "../server/service";

export const CATEGORY_ICON: Record<string, LucideIcon> = {
  book: BookOpen,
  course: GraduationCap,
  stationery: Package,
  electronics: Laptop,
  fashion: Shirt,
  service: Wrench,
  template: Sparkles,
  ticket: Ticket,
  other: Package,
};

export function ListingThumb({ category, size = "md", image, alt = "" }: { category: string; size?: "md" | "lg"; image?: string; alt?: string }) {
  if (image) {
    return (
      // eslint-disable-next-line @next/next/no-img-element -- server-processed WebP upload
      <img src={image} alt={alt} loading="lazy" className={`w-full rounded-2xl bg-surface-2 object-cover ${size === "lg" ? "h-64" : "aspect-square"}`} />
    );
  }
  const Icon = CATEGORY_ICON[category] ?? Package;
  return (
    <span className={`grid w-full place-items-center rounded-2xl bg-primary-soft text-primary ${size === "lg" ? "h-44" : "aspect-square"}`}>
      <Icon size={size === "lg" ? 64 : 40} strokeWidth={1.6} />
    </span>
  );
}

/** Product grid card (mockup 58 / 127). */
export function ListingCard({ l }: { l: Listing }) {
  return (
    <Link href={`/market/p/${l.id}`} className="pressable flex flex-col gap-2 rounded-[var(--radius-card)] border border-line bg-surface p-2.5 shadow-card">
      <ListingThumb category={l.category} image={l.images[0]} alt={l.title} />
      <span className="line-clamp-2 min-h-[2.5em] text-[14px] leading-snug font-semibold text-ink">{l.title}</span>
      <span className="text-[15px] font-extrabold text-primary">{l.price === 0 ? "Miễn phí" : formatVnd(l.price)}</span>
      <span className="flex items-center gap-1 text-[12px] text-muted">
        {l.rating !== null ? (
          <>
            <Star size={12} className="fill-warning text-warning" /> {l.rating} ({l.reviewCount})
          </>
        ) : (
          <span>{l.shopName}</span>
        )}
        {l.stock === 0 && <span className="ml-auto font-semibold text-expense">Hết hàng</span>}
      </span>
    </Link>
  );
}

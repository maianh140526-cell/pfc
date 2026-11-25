import Link from "next/link";
import { notFound } from "next/navigation";
import { ExternalLink, MapPin, Star } from "lucide-react";
import { currentMember, toActor } from "@/platform/auth/session";
import { formatVnd } from "@/lib/money";
import { timeAgo } from "@/lib/time";
import { PLACE_CATEGORIES, PRICE_LEVEL, getPlace } from "@/modules/finance/server/places";
import { PlaceModeration, ReviewForm, SavePlaceButton } from "@/modules/finance/ui/PlaceClient";
import { AppHeader, Badge, ButtonLink, Card, Section } from "@/ui";

export const metadata = { title: "Địa điểm" };
export const dynamic = "force-dynamic";

/** FIN-28/29/31 Place detail, reviews, write a review (mockups 34–36). */
export default async function PlacePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const me = await currentMember();
  const p = await getPlace(me ? toActor(me) : null, id);
  if (!p) notFound();
  const maps = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`${p.name}, ${p.address}`)}`;
  return (
    <>
      <AppHeader back backFallback="/finance/places" title="Địa điểm" actions={me && !p.hidden ? <SavePlaceButton id={p.id} initial={p.saved} /> : undefined} />
      {p.coverUrl && (
        <div className="px-4">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={p.coverUrl} alt="" className="aspect-[16/9] w-full rounded-[var(--radius-card)] object-cover" />
        </div>
      )}
      <div className="px-4 pt-3">
        {p.hidden && <p className="mb-2 rounded-xl bg-expense-soft px-3 py-2 text-[13px] text-expense">Đã bị ẩn: {p.hiddenReason}</p>}
        <div className="flex flex-wrap gap-2">
          <Badge tone="primary">{PLACE_CATEGORIES[p.category]}</Badge>
          <Badge tone="muted">{PRICE_LEVEL[p.priceLevel]}</Badge>
        </div>
        <h1 className="mt-2 text-[22px] font-extrabold text-ink">{p.name}</h1>
        <p className="mt-1 flex items-center gap-1 text-[14px] font-semibold text-ink">
          <Star size={16} className="fill-warning text-warning" /> {p.rating ?? "Chưa có"} · {p.reviews} đánh giá
          {p.avgSpend !== null && <span className="font-normal text-muted"> · chi trung bình {formatVnd(p.avgSpend)}</span>}
        </p>
      </div>
      <Section>
        <Card className="space-y-2 text-[14px]">
          <p className="flex gap-2 text-ink">
            <MapPin size={18} className="shrink-0 text-primary" /> {p.area ? `${p.address} (${p.area})` : p.address}
          </p>
          <a href={maps} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 font-semibold text-primary">
            Mở trong bản đồ <ExternalLink size={14} />
          </a>
          {p.description && <p className="whitespace-pre-line text-ink-2">{p.description}</p>}
          <p className="text-[12px] text-muted">
            Chia sẻ bởi{" "}
            <Link href={`/members/${p.authorId}`} className="font-semibold text-ink">
              {p.authorName}
            </Link>
          </p>
        </Card>
      </Section>
      {me && !p.hidden && (
        <Section title={p.mine ? "Đánh giá của bạn" : "Viết đánh giá"}>
          <ReviewForm placeId={p.id} initial={p.mine ? { rating: p.mine.rating, comment: p.mine.comment, avgSpend: p.mine.avgSpend } : null} />
        </Section>
      )}
      {!me && (
        <Section>
          <ButtonLink href={`/login?next=/finance/places/${p.id}`} block variant="secondary">
            Đăng nhập để đánh giá
          </ButtonLink>
        </Section>
      )}
      <Section title={`Đánh giá (${p.reviewsList.length})`}>
        {p.reviewsList.length === 0 ? (
          <p className="text-[14px] text-muted">Chưa có đánh giá.</p>
        ) : (
          <ul className="space-y-3">
            {p.reviewsList.map((r) => (
              <li key={r.id} className="rounded-xl border border-line bg-surface p-3">
                <p className="flex items-center justify-between text-[14px]">
                  <span className="font-semibold text-ink">{r.memberName}</span>
                  <span className="inline-flex items-center gap-0.5 text-ink">
                    {r.rating} <Star size={13} className="fill-warning text-warning" />
                  </span>
                </p>
                {r.comment && <p className="mt-1 text-[14px] whitespace-pre-line text-ink-2">{r.comment}</p>}
                <p className="mt-1 text-[12px] text-muted">
                  {timeAgo(r.createdAt)}
                  {r.avgSpend !== null && ` · chi khoảng ${formatVnd(r.avgSpend)}`}
                </p>
              </li>
            ))}
          </ul>
        )}
      </Section>
      {(p.canModerate || p.isAuthor) && (
        <Section>
          {p.isAuthor && (
            <div className="mb-2">
              <ButtonLink href={`/finance/places/${p.id}/edit`} variant="secondary" block>
                Sửa địa điểm
              </ButtonLink>
            </div>
          )}
          <PlaceModeration id={p.id} hidden={p.hidden} canModerate={p.canModerate} isAuthor={p.isAuthor} />
        </Section>
      )}
      <div className="h-6" />
    </>
  );
}

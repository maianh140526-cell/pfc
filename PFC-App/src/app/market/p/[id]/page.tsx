import Link from "next/link";
import { notFound } from "next/navigation";
import { BadgeCheck, BookOpen, CalendarDays, Star, Store, Truck } from "lucide-react";
import { currentMember, toActor } from "@/platform/auth/session";
import { formatVnd } from "@/lib/money";
import { CATEGORIES, DELIVERY_LABEL, KIND_LABEL } from "@/modules/market/domain/orders";
import { CONDITION_LABEL, type Condition } from "@/modules/market/domain/listings";
import { getListing } from "@/modules/market/server/service";
import { ListingThumb } from "@/modules/market/ui/ListingCard";
import { AppHeader, Badge, ButtonLink, Card, Section } from "@/ui";
import { BuyBar } from "./BuyBar";

export const dynamic = "force-dynamic";

/** MKT-05 Product / MKT-06 Service / MKT-07 Course detail (mockup 59 / 128). */
export default async function ListingPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const me = await currentMember();
  const l = await getListing(me ? toActor(me) : null, id);
  if (!l) notFound();
  const soldOut = l.stock === 0;
  return (
    <>
      <AppHeader back backFallback="/market" title="Chi tiết sản phẩm" />
      <div className="px-4">
        {l.images.length > 1 ? (
          <ul className="no-scrollbar -mx-4 flex snap-x snap-mandatory gap-2 overflow-x-auto px-4" aria-label="Ảnh sản phẩm">
            {l.images.map((u, i) => (
              <li key={u} className="w-[85%] shrink-0 snap-center">
                <ListingThumb category={l.category} size="lg" image={u} alt={`${l.title} — ảnh ${i + 1}/${l.images.length}`} />
              </li>
            ))}
          </ul>
        ) : (
          <ListingThumb category={l.category} size="lg" image={l.images[0]} alt={l.title} />
        )}
        <h1 className="mt-4 text-[20px] leading-tight font-extrabold text-ink">{l.title}</h1>
        <p className="mt-1 text-[24px] font-extrabold text-primary">
          {l.kind === "ticket" ? (l.price === 0 ? "Có vé miễn phí" : `Từ ${formatVnd(l.price)}`) : l.price === 0 ? "Miễn phí" : formatVnd(l.price)}
        </p>
        <div className="mt-2 flex flex-wrap gap-2">
          <Badge>{KIND_LABEL[l.kind]}</Badge>
          <Badge tone="muted">{CATEGORIES[l.category]}</Badge>
          {l.kind !== "ticket" && (soldOut ? <Badge tone="expense">Hết hàng</Badge> : l.stock !== null ? <Badge tone="income">Còn {l.stock}</Badge> : <Badge tone="income">Còn hàng</Badge>)}
        </div>
        {l.tags.length > 0 && (
          <ul className="mt-2 flex flex-wrap gap-1.5">
            {l.tags.map((t) => (
              <li key={t}>
                <Link href={`/market?tag=${encodeURIComponent(t)}`} className="rounded-full bg-surface-2 px-2.5 py-1 text-[12px] font-semibold text-ink-2">
                  #{t}
                </Link>
              </li>
            ))}
          </ul>
        )}
        <p className="mt-3 flex items-center gap-4 text-[13px] text-muted">
          <span className="flex items-center gap-1">
            <Star size={14} className="fill-warning text-warning" /> {l.rating ?? "Chưa có"} ({l.reviewCount} đánh giá)
          </span>
          <span className="flex items-center gap-1">
            <Truck size={14} /> {DELIVERY_LABEL[l.delivery]}
          </span>
          <span>Đã bán {l.sold}</span>
        </p>
      </div>
      <Section>
        <Link href={`/market/shop/${l.sellerId}`} className="pressable flex items-center gap-3 rounded-2xl border border-line bg-surface p-3">
          <span className="grid size-11 place-items-center rounded-full bg-primary-soft text-primary">
            <Store size={20} />
          </span>
          <span className="flex flex-1 items-center gap-1 text-[15px] font-semibold text-ink">
            {l.shopName}
            {l.sellerLevel === "verified" && <BadgeCheck size={16} className="text-primary" aria-label="Cửa hàng đã xác minh" />}
          </span>
          <span className="text-[13px] font-semibold text-primary">Xem cửa hàng</span>
        </Link>
      </Section>
      {(l.courseId || l.eventId) && (
        <Section>
          {l.courseId && (
            <Link href={`/learn/courses/${l.courseId}`} className="pressable flex items-center gap-3 rounded-2xl border border-line bg-surface p-3">
              <BookOpen size={20} className="text-primary" />
              <span className="flex-1 text-[14px] text-ink">Khóa học: <b>{l.courseTitle}</b></span>
            </Link>
          )}
          {l.eventId && (
            <Link href={`/events/${l.eventId}`} className="pressable flex items-center gap-3 rounded-2xl border border-line bg-surface p-3">
              <CalendarDays size={20} className="text-primary" />
              <span className="flex-1 text-[14px] text-ink">Sự kiện: <b>{l.eventTitle}</b></span>
            </Link>
          )}
        </Section>
      )}
      <Section title="Mô tả">
        <p className="text-[15px] leading-relaxed whitespace-pre-line text-ink-2">{l.description}</p>
      </Section>
      {(l.itemCondition || l.deliveryArea || l.serviceScope || l.availability || l.quotation || l.kind === "digital" || l.kind === "course") && (
        <Section title="Thông tin thêm">
          <dl className="divide-y divide-line rounded-[var(--radius-card)] border border-line bg-surface text-[14px]">
            {(
              [
                ["Tình trạng", l.itemCondition ? (CONDITION_LABEL[l.itemCondition as Condition] ?? l.itemCondition) : ""],
                ["Khu vực giao / nhận", l.deliveryArea],
                ["Phạm vi dịch vụ", l.serviceScope],
                ["Thời gian sẵn sàng", l.availability],
                ["Báo giá", l.quotation],
                ["Sau khi thanh toán", l.kind === "digital" ? "Tải tệp hoặc xem hướng dẫn truy cập trong đơn hàng" : l.kind === "course" ? "Mở khóa học trong đơn hàng" : ""],
              ] as const
            )
              .filter(([, v]) => v)
              .map(([k, v]) => (
                <div key={k} className="flex justify-between gap-4 px-4 py-2.5">
                  <dt className="shrink-0 text-muted">{k}</dt>
                  <dd className="text-right font-medium whitespace-pre-line text-ink">{v}</dd>
                </div>
              ))}
          </dl>
        </Section>
      )}
      <Section title={`Đánh giá (${l.reviewCount})`}>
        {l.reviews.length === 0 ? (
          <p className="text-[14px] text-muted">Chưa có đánh giá. Chỉ người mua đã nhận hàng mới đánh giá được.</p>
        ) : (
          <ul className="space-y-3">
            {l.reviews.map((r) => (
              <li key={r.id}>
                <Card className="p-3">
                  <p className="flex items-center gap-2 text-[13px] font-semibold text-ink">
                    {r.buyerName}
                    <span className="flex text-warning" aria-label={`${r.rating} sao`}>
                      {Array.from({ length: 5 }, (_, i) => (
                        <Star key={i} size={13} className={i < r.rating ? "fill-warning" : "text-line"} />
                      ))}
                    </span>
                  </p>
                  {r.comment && <p className="mt-1 text-[14px] text-ink-2">{r.comment}</p>}
                </Card>
              </li>
            ))}
          </ul>
        )}
      </Section>
      {l.isOwner ? (
        <Section>
          <ButtonLink href={`/market/sell/listings/${l.id}`} variant="secondary" block>
            Quản lý tin đăng
          </ButtonLink>
        </Section>
      ) : (
        l.status === "published" &&
        (l.kind === "ticket" && l.eventId ? (
          <Section>
            <ButtonLink href={`/events/${l.eventId}/register`} block>
              Mua vé tại trang sự kiện
            </ButtonLink>
          </Section>
        ) : (
          <BuyBar listingId={l.id} soldOut={soldOut} maxQty={l.stock ?? 99} favorite={l.favorite} signedIn={!!me} />
        ))
      )}
    </>
  );
}

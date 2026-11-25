import { notFound } from "next/navigation";
import { requireMember, toActor } from "@/platform/auth/session";
import { formatVnd } from "@/lib/money";
import { CATEGORIES, DELIVERY_LABEL, KIND_LABEL } from "@/modules/market/domain/orders";
import { getListing } from "@/modules/market/server/service";
import { AppHeader, Card, Section } from "@/ui";
import { ReviewListing } from "./ReviewListing";

export const dynamic = "force-dynamic";

/** Moderator view of a submitted listing (approve / reject with reason). */
export default async function ReviewListingPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const me = await requireMember(`/market/manage/listings/${id}`);
  const l = await getListing(toActor(me), id);
  if (!l || !l.canApprove) notFound();
  return (
    <>
      <AppHeader back backFallback="/market/manage" title="Duyệt tin đăng" />
      <Section>
        <Card>
          {l.images.length > 0 ? (
            <ul className="mb-3 grid grid-cols-3 gap-2" aria-label="Ảnh trong tin đăng">
              {l.images.map((u, i) => (
                <li key={u}>
                  <a href={u} target="_blank" rel="noopener noreferrer">
                    {/* eslint-disable-next-line @next/next/no-img-element -- uploaded image */}
                    <img src={u} alt={`Ảnh ${i + 1}`} className="aspect-square w-full rounded-xl object-cover" />
                  </a>
                </li>
              ))}
            </ul>
          ) : (
            <p className="mb-2 text-[13px] text-muted">Tin đăng không có ảnh.</p>
          )}
          <p className="text-[18px] font-bold text-ink">{l.title}</p>
          <p className="text-[20px] font-extrabold text-primary">{formatVnd(l.price)}</p>
          <p className="mt-1 text-[13px] text-muted">
            {l.shopName} · {KIND_LABEL[l.kind]} · {CATEGORIES[l.category]} · {DELIVERY_LABEL[l.delivery]} · {l.stock === null ? "không giới hạn" : `kho ${l.stock}`}
          </p>
          <p className="mt-3 text-[14px] whitespace-pre-line text-ink-2">{l.description}</p>
        </Card>
      </Section>
      <Section>
        <ReviewListing id={l.id} status={l.status} />
      </Section>
    </>
  );
}

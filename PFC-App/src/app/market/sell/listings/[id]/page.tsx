import { notFound } from "next/navigation";
import { requireMember, toActor } from "@/platform/auth/session";
import { getSettings } from "@/platform/settings/service";
import { getListing, getSeller, linkableItems } from "@/modules/market/server/service";
import { AppHeader } from "@/ui";
import { ListingEditor } from "../ListingEditor";

export const dynamic = "force-dynamic";

export default async function EditListingPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const me = await requireMember(`/market/sell/listings/${id}`);
  const actor = toActor(me);
  const l = await getListing(actor, id);
  if (!l || !l.isOwner) notFound();
  const [links, seller, s] = await Promise.all([linkableItems(actor), getSeller(me.id), getSettings()]);
  return (
    <>
      <AppHeader back backFallback="/market/sell" title="Quản lý tin đăng" />
      <ListingEditor
        links={links}
        level={seller?.level ?? "basic"}
        limits={s.market}
        existing={{
          id: l.id,
          status: l.status,
          rejectReason: l.rejectReason,
          canApprove: l.canApprove,
          kind: l.kind,
          category: l.category,
          title: l.title,
          description: l.description,
          price: String(l.price),
          stock: String(l.stock ?? 0),
          unlimited: l.stock === null,
          delivery: l.delivery,
          images: l.images,
          tags: l.tags,
          courseId: l.courseId ?? "",
          eventId: l.eventId ?? "",
          itemCondition: l.itemCondition,
          deliveryArea: l.deliveryArea,
          serviceScope: l.serviceScope,
          availability: l.availability,
          quotation: l.quotation,
          accessInfo: l.access?.info ?? "",
          fileUrl: l.access?.fileUrl ?? "",
          fileName: l.access?.fileName ?? "",
        }}
      />
    </>
  );
}

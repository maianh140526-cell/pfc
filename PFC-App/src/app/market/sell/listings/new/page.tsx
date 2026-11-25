import { redirect } from "next/navigation";
import { requireMember, toActor } from "@/platform/auth/session";
import { getSettings } from "@/platform/settings/service";
import { getSeller, linkableItems } from "@/modules/market/server/service";
import { AppHeader, Section } from "@/ui";
import { SellerRegistration } from "../../SellerRegistration";
import { ListingEditor } from "../ListingEditor";

export const metadata = { title: "Đăng tin" };
export const dynamic = "force-dynamic";

/** Any signed-in member can sell: first time, open a shop here (one short form), then post the listing. */
export default async function NewListingPage() {
  const me = await requireMember("/market/sell/listings/new");
  const s = await getSeller(me.id);
  if (s && (s.status === "pending" || s.status === "suspended")) redirect("/market/sell");
  if (!s || s.status !== "approved") {
    return (
      <>
        <AppHeader back backFallback="/market" title="Đăng bán" />
        <Section>
          <p className="rounded-xl bg-primary-soft px-4 py-3 text-[14px] text-ink-2">Bước 1/2: mở cửa hàng (chỉ làm một lần). Xong bạn đăng sản phẩm ngay ở bước 2.</p>
        </Section>
        <SellerRegistration submitLabel="Mở cửa hàng và đăng bán" />
      </>
    );
  }
  const [links, settings] = await Promise.all([linkableItems(toActor(me)), getSettings()]);
  return (
    <>
      <AppHeader back backFallback="/market/sell" title="Đăng tin mới" />
      <ListingEditor links={links} level={s.level} limits={settings.market} />
    </>
  );
}

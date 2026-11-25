import { redirect } from "next/navigation";
import { requireMember } from "@/platform/auth/session";
import { getSeller } from "@/modules/market/server/service";
import { AppHeader } from "@/ui";
import { SellerRegistration } from "../SellerRegistration";

export const metadata = { title: "Hồ sơ cửa hàng" };
export const dynamic = "force-dynamic";

/** SELL-17 Seller Settings. */
export default async function SellerProfilePage() {
  const me = await requireMember("/market/sell/profile");
  const s = await getSeller(me.id);
  if (!s || s.status !== "approved") redirect("/market/sell");
  return (
    <>
      <AppHeader back backFallback="/market/sell" title="Hồ sơ cửa hàng" />
      <SellerRegistration initial={{ shopName: s.shopName, bio: s.bio, contact: s.contact }} submitLabel="Lưu hồ sơ" />
    </>
  );
}

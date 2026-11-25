import { Heart, ShieldCheck, Store } from "lucide-react";
import { currentMember, toActor } from "@/platform/auth/session";
import { can } from "@/platform/roles";
import { AppHeader, ListGroup, ListItem, Section } from "@/ui";

export const metadata = { title: "Thêm" };
export const dynamic = "force-dynamic";

export default async function MarketMorePage() {
  const me = await currentMember();
  const actor = me ? toActor(me) : null;
  const canModerate = can(actor, "mkt.listing.approve") || can(actor, "mkt.seller.approve");
  return (
    <>
      <AppHeader title="Thêm" backHref="/market" />
      <Section>
        <ListGroup>
          <ListItem icon={Heart} title="Sản phẩm yêu thích" href="/market/favorites" />
          <ListItem icon={Store} title="Kênh người bán" href="/market/sell" />
          {canModerate && <ListItem icon={ShieldCheck} title="Kiểm duyệt Marketplace" description="Duyệt người bán và tin đăng" href="/market/manage" />}
        </ListGroup>
      </Section>
      <Section>
        <p className="text-[12px] leading-relaxed text-muted">
          Giao dịch diễn ra trực tiếp giữa người mua và người bán. PFC kiểm duyệt người bán và tin đăng nhưng chưa thu tiền hộ; thanh toán trực tuyến (VNPAY) sẽ được bổ sung theo lộ trình SRS.
        </p>
      </Section>
    </>
  );
}

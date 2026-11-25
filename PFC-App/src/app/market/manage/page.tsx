import Link from "next/link";
import { ShieldAlert } from "lucide-react";
import { requireMember, toActor } from "@/platform/auth/session";
import { formatVnd } from "@/lib/money";
import { can } from "@/platform/roles";
import { listSellersByStatus, listingQueue, verificationQueue } from "@/modules/market/server/service";
import { AppHeader, Badge, EmptyState, Section } from "@/ui";
import { SellerDecision } from "./SellerDecision";
import { VerifyDecision } from "./VerifyDecision";

export const metadata = { title: "Kiểm duyệt Marketplace" };
export const dynamic = "force-dynamic";

/** ADM-14/15 Seller Management & Verification · ADM-16 Product moderation. */
export default async function MarketManagePage() {
  const me = await requireMember("/market/manage");
  const actor = toActor(me);
  const canListings = can(actor, "mkt.listing.approve");
  const canSellers = can(actor, "mkt.seller.approve");
  if (!canListings && !canSellers) {
    return (
      <>
        <AppHeader back backFallback="/market/more" title="Kiểm duyệt" />
        <EmptyState icon={ShieldAlert} title="Không có quyền" description="Chủ nhiệm, Ban điều hành và Trưởng ban Truyền thông kiểm duyệt Marketplace." />
      </>
    );
  }
  const [pendingSellers, activeSellers, queue, verify] = await Promise.all([
    canSellers ? listSellersByStatus(actor, "pending") : Promise.resolve([]),
    canSellers ? listSellersByStatus(actor, "approved") : Promise.resolve([]),
    canListings ? listingQueue(actor) : Promise.resolve([]),
    canSellers ? verificationQueue(actor) : Promise.resolve([]),
  ]);
  return (
    <>
      <AppHeader back backFallback="/market/more" title="Kiểm duyệt Marketplace" />
      {canSellers && (
        <Section title={`Người bán chờ duyệt (${pendingSellers.length})`}>
          {pendingSellers.length === 0 ? (
            <p className="text-[14px] text-muted">Không có hồ sơ chờ duyệt.</p>
          ) : (
            <ul className="space-y-3">
              {pendingSellers.map((s) => (
                <li key={s.memberId}>
                  <SellerDecision seller={{ memberId: s.memberId, shopName: s.shopName, memberName: s.memberName, bio: s.bio, contact: s.contact }} mode="pending" />
                </li>
              ))}
            </ul>
          )}
        </Section>
      )}
      {canSellers && verify.length > 0 && (
        <Section title={`Yêu cầu xác minh cửa hàng (${verify.length})`}>
          <ul className="space-y-3">
            {verify.map((s) => (
              <li key={s.memberId}>
                <VerifyDecision s={{ memberId: s.memberId, shopName: s.shopName, memberName: s.memberName, legalName: s.legalName, phone: s.phone, note: s.verifyNote }} />
              </li>
            ))}
          </ul>
        </Section>
      )}
      {canListings && (
        <Section title={`Tin đăng chờ duyệt (${queue.length})`}>
          {queue.length === 0 ? (
            <p className="text-[14px] text-muted">Không có tin chờ duyệt.</p>
          ) : (
            <ul className="divide-y divide-line overflow-hidden rounded-[var(--radius-card)] border border-line bg-surface">
              {queue.map((l) => (
                <li key={l.id}>
                  <Link href={`/market/manage/listings/${l.id}`} className="flex items-center gap-3 px-4 py-3 active:bg-surface-2">
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-[15px] font-semibold text-ink">{l.title}</span>
                      <span className="block text-[12px] text-muted">
                        {l.shopName} · {formatVnd(l.price)}
                      </span>
                    </span>
                    <Badge tone="warning">Xem</Badge>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </Section>
      )}
      {canSellers && activeSellers.length > 0 && (
        <Section title={`Người bán đang hoạt động (${activeSellers.length})`}>
          <ul className="space-y-3">
            {activeSellers.map((s) => (
              <li key={s.memberId}>
                <SellerDecision seller={{ memberId: s.memberId, shopName: s.shopName, memberName: s.memberName, bio: s.bio, contact: s.contact }} mode="active" />
              </li>
            ))}
          </ul>
        </Section>
      )}
    </>
  );
}

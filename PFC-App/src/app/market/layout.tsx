import { MarketTabBar } from "@/modules/market/ui/MarketTabBar";

export const metadata = { title: { default: "Marketplace", template: "%s · Marketplace · PFC" } };

/** Marketplace interior (FR-MKT). Browsing is open; buying/selling needs a PFC account. */
export default function MarketLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <div className="with-tabbar">{children}</div>
      <MarketTabBar />
    </>
  );
}

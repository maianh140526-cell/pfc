import { requireMember } from "@/platform/auth/session";
import { FinanceTabBar } from "@/modules/finance/ui/FinanceTabBar";

export const metadata = { title: { default: "Tài chính", template: "%s · Tài chính · PFC" } };

/** Personal Finance hub: owner-only data, so every screen requires a PFC account. */
export default async function FinanceLayout({ children }: { children: React.ReactNode }) {
  await requireMember("/finance");
  return (
    <>
      <div className="with-tabbar">{children}</div>
      <FinanceTabBar />
    </>
  );
}

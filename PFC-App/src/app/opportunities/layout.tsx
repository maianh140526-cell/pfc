import { OppSessionProvider } from "@/modules/opportunity/session";
import { OppTabBar } from "@/modules/opportunity/ui/OppTabBar";

export const metadata = { title: { default: "Cơ hội", template: "%s · Cơ hội · PFC" } };

/** Opportunity Hub interior (FR-OPP). Browsing is public; save/apply need sign-in. */
export default function OpportunitiesLayout({ children }: { children: React.ReactNode }) {
  return (
    <OppSessionProvider>
      <div className="with-tabbar">{children}</div>
      <OppTabBar />
    </OppSessionProvider>
  );
}

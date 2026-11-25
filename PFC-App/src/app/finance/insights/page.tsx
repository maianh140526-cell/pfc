import { requireMember } from "@/platform/auth/session";
import { insightsFor } from "@/modules/finance/server/insights";
import { InsightList } from "@/modules/finance/ui/InsightList";
import { MonthSwitcher } from "@/modules/finance/ui/MonthSwitcher";
import { monthParam } from "@/modules/finance/ui/page-params";
import { AppHeader, Section } from "@/ui";

export const metadata = { title: "Gợi ý tài chính" };
export const dynamic = "force-dynamic";

/** Financial insights from the member's own data (rule-based, explainable). */
export default async function InsightsPage({ searchParams }: { searchParams: Promise<Record<string, string>> }) {
  const me = await requireMember("/finance/insights");
  const month = monthParam((await searchParams).month);
  const items = await insightsFor(me.id, month);
  return (
    <>
      <AppHeader back backFallback="/finance/more" title="Gợi ý tài chính" />
      <div className="px-4">
        <MonthSwitcher month={month} basePath="/finance/insights" />
      </div>
      <Section>
        <InsightList items={items} />
        <p className="mt-4 pb-6 text-[12px] text-muted">Gợi ý tự động từ thu chi, ngân sách và mục tiêu của chính bạn. Không phải tư vấn tài chính cá nhân.</p>
      </Section>
    </>
  );
}

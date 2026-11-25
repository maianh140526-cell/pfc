"use client";

import { Bookmark } from "lucide-react";
import { useHub } from "@/platform/hub-proxy/client";
import { HubErrorState, ListSkeleton } from "@/platform/hub-proxy/HubStates";
import { OPP_RUN_HINT } from "@/modules/opportunity/session";
import type { Opportunity } from "@/modules/opportunity/types";
import { OppCard } from "@/modules/opportunity/ui/OppCard";
import { OppGate } from "@/modules/opportunity/ui/OppGate";
import { useSaves } from "@/modules/opportunity/use-saves";
import { AppHeader, ButtonLink, EmptyState } from "@/ui";

/** OPP-11 Saved Opportunities. */
export default function SavedPage() {
  return (
    <>
      <AppHeader title="Đã lưu" backHref="/opportunities" />
      <OppGate>{() => <SavedList />}</OppGate>
    </>
  );
}

function SavedList() {
  const { data, error, loading, reload } = useHub<{ items: Array<{ id: string; opportunity: Opportunity }> }>("opp", "/me/saves");
  const saves = useSaves();
  if (loading && !data) return <ListSkeleton />;
  if (error) return <HubErrorState error={error} onRetry={reload} hubName="Cơ hội" runHint={OPP_RUN_HINT} />;
  const items = (data?.items ?? []).filter((s) => saves.ids.size === 0 || saves.ids.has(s.opportunity.id));
  if (items.length === 0) {
    return (
      <EmptyState
        icon={Bookmark}
        title="Chưa lưu cơ hội nào"
        description="Bấm biểu tượng dấu trang để lưu và nhận nhắc hạn nộp."
        action={
          <ButtonLink href="/opportunities" block>
            Khám phá cơ hội
          </ButtonLink>
        }
      />
    );
  }
  return (
    <div className="space-y-3 px-4 pt-2">
      {items.map((s) => (
        <OppCard key={s.id} o={s.opportunity} saved onToggleSave={() => saves.toggle(s.opportunity.id)} />
      ))}
    </div>
  );
}

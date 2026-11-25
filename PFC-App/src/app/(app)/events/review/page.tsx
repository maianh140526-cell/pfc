import { notFound } from "next/navigation";
import { ClipboardCheck } from "lucide-react";
import { requireMember, toActor } from "@/platform/auth/session";
import { can } from "@/platform/roles";
import { approvalQueue } from "@/modules/events/server/service";
import { EventCard } from "@/modules/events/ui/EventCard";
import { AppHeader, EmptyState } from "@/ui";

export const metadata = { title: "Duyệt sự kiện" };
export const dynamic = "force-dynamic";

/** EVT-A04 Approval queue (Ban Sự kiện / BĐH). */
export default async function ReviewEventsPage() {
  const me = await requireMember("/events/review");
  const actor = toActor(me);
  if (!can(actor, "event.approve")) notFound();
  const list = await approvalQueue(actor);
  return (
    <>
      <AppHeader back backFallback="/events" title="Duyệt sự kiện" />
      {list.length === 0 ? (
        <EmptyState icon={ClipboardCheck} title="Không có sự kiện chờ duyệt" />
      ) : (
        <ul className="space-y-3 px-4 pb-4">
          {list.map((e) => (
            <li key={e.id}>
              <EventCard e={e} showStatus />
            </li>
          ))}
        </ul>
      )}
    </>
  );
}

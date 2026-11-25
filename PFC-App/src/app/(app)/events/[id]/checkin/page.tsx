import { notFound } from "next/navigation";
import { requireMember, toActor } from "@/platform/auth/session";
import { getEvent } from "@/modules/events/server/service";
import { CheckInScanner } from "@/modules/events/ui/CheckInScanner";
import { AppHeader } from "@/ui";

export const metadata = { title: "Check-in" };
export const dynamic = "force-dynamic";

/** EVT-15 Check-in (organizer / Ban Sự kiện). */
export default async function CheckInPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const me = await requireMember(`/events/${id}/checkin`);
  const e = await getEvent(toActor(me), id);
  if (!e || !e.canManage || e.status !== "published") notFound();
  return (
    <>
      <AppHeader back backFallback={`/events/${id}/manage`} title="Check-in" subtitle={e.title} />
      <CheckInScanner eventId={id} />
    </>
  );
}

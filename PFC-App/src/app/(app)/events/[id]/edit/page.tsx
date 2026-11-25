import { notFound } from "next/navigation";
import { requireMember, toActor } from "@/platform/auth/session";
import { getEvent } from "@/modules/events/server/service";
import { onlinePaymentEnabled } from "@/modules/payments/server/service";
import { EventForm } from "@/modules/events/ui/EventForm";
import { AppHeader } from "@/ui";

export const metadata = { title: "Sửa sự kiện" };
export const dynamic = "force-dynamic";

/** EVT-06 Edit Event (organizer only). */
export default async function EditEventPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const me = await requireMember(`/events/${id}/edit`);
  const e = await getEvent(toActor(me), id);
  if (!e || !e.isOrganizer || !["draft", "rejected", "published"].includes(e.status)) notFound();
  return (
    <>
      <AppHeader back backFallback={`/events/${id}`} title="Sửa sự kiện" />
      <EventForm
        id={id}
        onlinePayments={onlinePaymentEnabled()}
        ticketsLocked={e.attendees > 0 || e.tickets.some((t) => t.left !== null && t.capacity !== null && t.left < t.capacity)}
        initial={{
          title: e.title,
          summary: e.summary,
          description: e.description,
          category: e.category,
          mode: e.mode,
          location: e.location,
          onlineUrl: e.onlineUrl ?? "",
          startsAt: e.startsAt,
          endsAt: e.endsAt,
          deadline: e.deadline ?? "",
          capacity: e.capacity === null ? "" : String(e.capacity),
          payAtDoor: e.payAtDoor,
          cover: e.coverUrl ? [e.coverUrl] : [],
          agenda: e.agenda,
          speakers: e.speakers,
          tickets: e.tickets.map((t) => ({ name: t.name, description: t.description, price: String(t.price), capacity: t.capacity === null ? "" : String(t.capacity) })),
        }}
      />
    </>
  );
}

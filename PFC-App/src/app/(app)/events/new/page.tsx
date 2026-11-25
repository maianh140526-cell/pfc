import { requireMember } from "@/platform/auth/session";
import { onlinePaymentEnabled } from "@/modules/payments/server/service";
import { EventForm } from "@/modules/events/ui/EventForm";
import { AppHeader } from "@/ui";

export const metadata = { title: "Tạo sự kiện" };
export const dynamic = "force-dynamic";

/** EVT-05 Create Event. */
export default async function NewEventPage({ searchParams }: { searchParams: Promise<{ club?: string }> }) {
  const forClub = (await searchParams).club === "1";
  await requireMember(forClub ? "/events/new?club=1" : "/events/new");
  return (
    <>
      <AppHeader back backFallback={forClub ? "/club/activities?tab=events" : "/events"} title={forClub ? "Tạo sự kiện của CLB" : "Tạo sự kiện"} />
      <EventForm onlinePayments={onlinePaymentEnabled()} forClub={forClub} />
    </>
  );
}

import { notFound, redirect } from "next/navigation";
import { requireMember, toActor } from "@/platform/auth/session";
import { getEvent } from "@/modules/events/server/service";
import { RegisterForm } from "@/modules/events/ui/RegisterForm";
import { eventWhen } from "@/modules/events/ui/format";
import { AppHeader, EmptyState } from "@/ui";
import { CalendarX } from "lucide-react";

export const metadata = { title: "Đăng ký sự kiện" };
export const dynamic = "force-dynamic";

/** EVT-07 Event Registration (mockup 72). */
export default async function RegisterPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const me = await requireMember(`/events/${id}/register`);
  const e = await getEvent(toActor(me), id);
  if (!e) notFound();
  if (e.my && (e.my.status === "confirmed" || e.my.status === "pending_payment")) redirect(`/events/tickets/${e.my.id}`);
  return (
    <>
      <AppHeader back backFallback={`/events/${id}`} title="Đăng ký" />
      <div className="px-4 pb-2">
        <p className="text-[16px] font-bold text-ink">{e.title}</p>
        <p className="text-[13px] text-muted">{eventWhen(e.startsAt, e.endsAt)}</p>
      </div>
      {e.registrationError ? (
        <EmptyState icon={CalendarX} title={e.registrationError} />
      ) : (
        <RegisterForm eventId={id} tickets={e.tickets} payAtDoor={e.payAtDoor} onlinePayments={e.onlinePayments} defaults={{ name: me.fullName ?? "", email: me.email ?? "", phone: "" }} />
      )}
    </>
  );
}

import Link from "next/link";
import { Ticket } from "lucide-react";
import { requireMember, toActor } from "@/platform/auth/session";
import { myTickets } from "@/modules/events/server/service";
import { REG_STATUS_LABEL, REG_STATUS_TONE, eventWhen } from "@/modules/events/ui/format";
import { vnLocal } from "@/modules/events/domain/events";
import { AppHeader, Badge, ButtonLink, EmptyState, Section } from "@/ui";

export const metadata = { title: "Vé của tôi" };
export const dynamic = "force-dynamic";

/** EVT-13 My Tickets. */
export default async function MyTicketsPage() {
  const me = await requireMember("/events/tickets");
  const list = await myTickets(toActor(me));
  const now = vnLocal(new Date());
  const upcoming = list.filter((t) => t.startsAt >= now).reverse();
  const past = list.filter((t) => t.startsAt < now);
  const Row = ({ t }: { t: (typeof list)[number] }) => (
    <li>
      <Link href={`/events/tickets/${t.id}`} className="pressable flex items-center gap-3 rounded-[var(--radius-card)] border border-line bg-surface p-3">
        <span className="grid size-11 shrink-0 place-items-center rounded-2xl bg-primary-soft text-primary">
          <Ticket size={22} />
        </span>
        <span className="min-w-0 flex-1">
          <span className="block truncate text-[15px] font-bold text-ink">{t.eventTitle}</span>
          <span className="block text-[12px] text-muted">
            {eventWhen(t.startsAt)} · {t.ticketName}
          </span>
        </span>
        <Badge tone={REG_STATUS_TONE[t.status]}>{t.checkedInAt ? "Đã check-in" : REG_STATUS_LABEL[t.status]}</Badge>
      </Link>
    </li>
  );
  return (
    <>
      <AppHeader back backFallback="/events" title="Vé của tôi" />
      {list.length === 0 ? (
        <EmptyState icon={Ticket} title="Chưa có vé nào" description="Đăng ký sự kiện để nhận vé có mã QR check-in." action={<ButtonLink href="/events" block>Khám phá sự kiện</ButtonLink>} />
      ) : (
        <>
          {upcoming.length > 0 && (
            <Section title="Sắp diễn ra">
              <ul className="space-y-2">{upcoming.map((t) => <Row key={t.id} t={t} />)}</ul>
            </Section>
          )}
          {past.length > 0 && (
            <Section title="Đã qua">
              <ul className="space-y-2 pb-4">{past.map((t) => <Row key={t.id} t={t} />)}</ul>
            </Section>
          )}
        </>
      )}
    </>
  );
}

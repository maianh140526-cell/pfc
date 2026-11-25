import { notFound } from "next/navigation";
import { Download, QrCode } from "lucide-react";
import { requireMember, toActor } from "@/platform/auth/session";
import { formatVnd } from "@/lib/money";
import { attendees, dashboard, getEvent } from "@/modules/events/server/service";
import { REG_STATUS_LABEL, REG_STATUS_TONE, eventWhen } from "@/modules/events/ui/format";
import { AppHeader, Badge, ButtonLink, Card, Section } from "@/ui";

export const metadata = { title: "Quản lý sự kiện" };
export const dynamic = "force-dynamic";

/** EVT-A01…A03 Organizer dashboard: numbers, tickets sold, attendee list, CSV, check-in. */
export default async function ManageEventPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const me = await requireMember(`/events/${id}/manage`);
  const actor = toActor(me);
  const e = await getEvent(actor, id);
  if (!e || !e.canManage) notFound();
  const [d, list] = await Promise.all([dashboard(actor, id), attendees(actor, id)]);
  const stats = [
    { label: "Đã đăng ký", value: String(d.registered) },
    { label: "Đã check-in", value: `${d.checkedIn}/${d.registered}` },
    { label: "Thu qua VNPAY", value: formatVnd(d.revenueOnline) },
    { label: "Thu tại quầy", value: formatVnd(d.revenueDoor) },
  ];
  return (
    <>
      <AppHeader back backFallback={`/events/${id}`} title="Quản lý sự kiện" />
      <div className="px-4">
        <p className="text-[16px] font-bold text-ink">{e.title}</p>
        <p className="text-[13px] text-muted">{eventWhen(e.startsAt, e.endsAt)}</p>
      </div>
      <Section>
        <div className="grid grid-cols-2 gap-2">
          {stats.map((s) => (
            <Card key={s.label} className="p-3">
              <p className="text-[12px] text-muted">{s.label}</p>
              <p className="text-[18px] font-extrabold text-ink">{s.value}</p>
            </Card>
          ))}
        </div>
      </Section>
      <Section>
        <div className="grid grid-cols-2 gap-2">
          {e.status === "published" && (
            <ButtonLink href={`/events/${id}/checkin`}>
              <QrCode size={18} /> Check-in
            </ButtonLink>
          )}
          <a href={`/api/events/${id}/attendees`} className="pressable inline-flex min-h-12 items-center justify-center gap-2 rounded-[var(--radius-control)] border border-primary bg-surface px-5 text-[15px] font-semibold text-primary">
            <Download size={18} /> Xuất CSV
          </a>
        </div>
      </Section>
      <Section title="Vé đã bán">
        <ul className="space-y-1 text-[14px]">
          {d.byTicket.map((t) => (
            <li key={t.name} className="flex justify-between">
              <span className="text-ink">{t.name}</span>
              <span className="font-semibold text-ink">
                {t.sold}
                {t.capacity !== null && `/${t.capacity}`}
              </span>
            </li>
          ))}
        </ul>
      </Section>
      <Section title={`Người tham dự (${list.length})`}>
        {list.length === 0 ? (
          <p className="text-[14px] text-muted">Chưa có người đăng ký.</p>
        ) : (
          <ul className="divide-y divide-line overflow-hidden rounded-[var(--radius-card)] border border-line bg-surface pb-0">
            {list.map((a) => (
              <li key={a.id} className="flex items-center gap-3 px-4 py-3">
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-[14px] font-semibold text-ink">{a.name}</span>
                  <span className="block truncate text-[12px] text-muted">
                    {a.ticketName} · {a.email}
                    {a.phone && ` · ${a.phone}`}
                  </span>
                </span>
                {a.checkedInAt ? <Badge tone="income">Đã check-in</Badge> : <Badge tone={REG_STATUS_TONE[a.status]}>{a.price > 0 && !a.paid ? "Trả tại quầy" : REG_STATUS_LABEL[a.status]}</Badge>}
              </li>
            ))}
          </ul>
        )}
        <div className="h-4" />
      </Section>
    </>
  );
}

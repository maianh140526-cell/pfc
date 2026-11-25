import Link from "next/link";
import { notFound } from "next/navigation";
import { CalendarClock, ExternalLink, MapPin, Ticket, UserRound, Users, Video } from "lucide-react";
import { currentMember, toActor } from "@/platform/auth/session";
import { can } from "@/platform/roles";
import { formatVnd } from "@/lib/money";
import { CATEGORIES, EVENT_STATUS_LABEL, EVENT_STATUS_TONE, MODES } from "@/modules/events/domain/events";
import { getEvent } from "@/modules/events/server/service";
import { EventActions, FavoriteButton } from "@/modules/events/ui/EventClient";
import { REG_STATUS_LABEL, REG_STATUS_TONE, eventWhen, priceRange } from "@/modules/events/ui/format";
import { AppHeader, Badge, ButtonLink, Card, Section } from "@/ui";

export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }) {
  const e = await getEvent(null, (await params).id);
  return { title: e?.title ?? "Sự kiện" };
}

/** EVT-03 Event Detail (mockup 71). */
export default async function EventPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const me = await currentMember();
  const actor = me ? toActor(me) : null;
  const e = await getEvent(actor, id);
  if (!e) notFound();
  const activeReg = e.my && (e.my.status === "confirmed" || e.my.status === "pending_payment") ? e.my : null;
  return (
    <>
      <AppHeader back backFallback="/events" title="Chi tiết sự kiện" actions={me && e.status === "published" ? <FavoriteButton id={e.id} initial={e.favorite} /> : undefined} />
      {e.coverUrl && (
        <div className="px-4">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={e.coverUrl} alt="" className="aspect-[16/9] w-full rounded-[var(--radius-card)] object-cover" />
        </div>
      )}
      <div className="px-4 pt-4">
        <div className="flex flex-wrap gap-2">
          <Badge tone="primary">{CATEGORIES[e.category]}</Badge>
          <Badge tone="muted">{MODES[e.mode]}</Badge>
          {e.status !== "published" && <Badge tone={EVENT_STATUS_TONE[e.status]}>{EVENT_STATUS_LABEL[e.status]}</Badge>}
        </div>
        <h1 className="mt-2 text-[22px] leading-tight font-extrabold text-ink">{e.title}</h1>
        {e.summary && <p className="mt-1 text-[14px] text-muted">{e.summary}</p>}
      </div>

      {e.rejectReason && e.status === "rejected" && (
        <Section>
          <p className="rounded-xl bg-expense-soft px-4 py-3 text-[14px] text-expense">Bị từ chối: {e.rejectReason}</p>
        </Section>
      )}
      {e.cancelReason && e.status === "cancelled" && (
        <Section>
          <p className="rounded-xl bg-expense-soft px-4 py-3 text-[14px] text-expense">Sự kiện đã hủy: {e.cancelReason}</p>
        </Section>
      )}

      <Section>
        <Card className="space-y-3 text-[14px]">
          <p className="flex gap-3">
            <CalendarClock size={20} className="shrink-0 text-primary" />
            <span>
              <span className="block font-semibold text-ink">{eventWhen(e.startsAt, e.endsAt)}</span>
              {e.deadline && <span className="block text-[12px] text-muted">Hạn đăng ký: {e.deadline.replace("T", " ")}</span>}
            </span>
          </p>
          {e.mode !== "online" && (
            <p className="flex gap-3">
              <MapPin size={20} className="shrink-0 text-primary" />
              <span className="text-ink">{e.location}</span>
            </p>
          )}
          {e.mode !== "offline" && (
            <p className="flex gap-3">
              <Video size={20} className="shrink-0 text-primary" />
              {e.onlineUrl ? (
                <a href={e.onlineUrl} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 font-semibold break-all text-primary">
                  Link tham gia <ExternalLink size={14} />
                </a>
              ) : (
                <span className="text-muted">Link tham gia hiển thị sau khi đăng ký thành công.</span>
              )}
            </p>
          )}
          <p className="flex gap-3">
            <UserRound size={20} className="shrink-0 text-primary" />
            <Link href={`/members/${e.organizerId}`} className="font-semibold text-ink">
              {e.organizerName}
            </Link>
          </p>
          <p className="flex gap-3">
            <Users size={20} className="shrink-0 text-primary" />
            <span className="text-ink">
              {e.attendees} người đã đăng ký{e.seatsLeft !== null && ` · còn ${e.seatsLeft} chỗ`}
            </span>
          </p>
        </Card>
      </Section>

      {e.description && (
        <Section title="Giới thiệu">
          <p className="text-[15px] leading-relaxed whitespace-pre-line text-ink-2">{e.description}</p>
        </Section>
      )}
      {e.agenda.length > 0 && (
        <Section title="Chương trình">
          <ol className="space-y-2">
            {e.agenda.map((x, i) => (
              <li key={i} className="flex gap-3 text-[14px]">
                <span className="w-14 shrink-0 font-bold text-primary">{x.time}</span>
                <span className="text-ink">{x.title}</span>
              </li>
            ))}
          </ol>
        </Section>
      )}
      {e.speakers.length > 0 && (
        <Section title="Diễn giả">
          <ul className="space-y-2">
            {e.speakers.map((s, i) => (
              <li key={i} className="flex items-center gap-3">
                <span className="grid size-10 place-items-center rounded-full bg-primary-soft text-[15px] font-bold text-primary">{s.name.slice(0, 1).toUpperCase()}</span>
                <span>
                  <span className="block text-[14px] font-semibold text-ink">{s.name}</span>
                  {s.title && <span className="block text-[12px] text-muted">{s.title}</span>}
                </span>
              </li>
            ))}
          </ul>
        </Section>
      )}
      <Section title="Loại vé">
        <ul className="space-y-2">
          {e.tickets.map((t) => (
            <li key={t.id} className="flex items-center justify-between gap-3 rounded-xl border border-line bg-surface px-4 py-3">
              <span className="min-w-0">
                <span className="block text-[14px] font-semibold text-ink">{t.name}</span>
                {t.description && <span className="block text-[12px] text-muted">{t.description}</span>}
                {t.left !== null && <span className="block text-[12px] text-muted">{t.left > 0 ? `Còn ${t.left} vé` : "Hết vé"}</span>}
              </span>
              <span className="shrink-0 text-[15px] font-bold text-ink">{t.price ? formatVnd(t.price) : "Miễn phí"}</span>
            </li>
          ))}
        </ul>
        {e.payAtDoor && e.maxPrice > 0 && <p className="mt-2 text-[12px] text-muted">Vé có phí thanh toán tại quầy check-in.</p>}
      </Section>

      <Section>
        <div className="space-y-3 pb-4">
          {activeReg ? (
            <Card className="flex items-center justify-between gap-3">
              <span>
                <span className="block text-[14px] font-semibold text-ink">Vé của bạn: {activeReg.ticketName}</span>
                <Badge tone={REG_STATUS_TONE[activeReg.status]}>{REG_STATUS_LABEL[activeReg.status]}</Badge>
              </span>
              <ButtonLink href={`/events/tickets/${activeReg.id}`}>
                <Ticket size={18} /> Xem vé
              </ButtonLink>
            </Card>
          ) : e.status === "published" ? (
            e.registrationError ? (
              <p className="rounded-xl bg-surface-2 px-4 py-3 text-center text-[14px] font-semibold text-muted">{e.registrationError}</p>
            ) : (
              <ButtonLink href={me ? `/events/${e.id}/register` : `/login?next=/events/${e.id}/register`} block>
                Đăng ký · {priceRange(e.minPrice, e.maxPrice)}
              </ButtonLink>
            )
          ) : null}
          {e.canManage && (
            <>
              <EventActions id={e.id} actions={e.actions} approverPublishes={!!actor && can(actor, "event.approve")} />
              <div className="grid grid-cols-2 gap-2">
                {e.isOrganizer && ["draft", "rejected", "published"].includes(e.status) && (
                  <ButtonLink href={`/events/${e.id}/edit`} variant="secondary">
                    Sửa sự kiện
                  </ButtonLink>
                )}
                {["published", "completed", "cancelled"].includes(e.status) && (
                  <ButtonLink href={`/events/${e.id}/manage`} variant="secondary">
                    Quản lý & check-in
                  </ButtonLink>
                )}
              </div>
            </>
          )}
        </div>
      </Section>
    </>
  );
}

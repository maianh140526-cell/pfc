import Link from "next/link";
import { MapPin, Users, Video } from "lucide-react";
import { Badge } from "@/ui";
import { EVENT_STATUS_LABEL, EVENT_STATUS_TONE, MODES, type EventStatus } from "../domain/events";
import type { EventCard as Card } from "../server/service";
import { dayBadge, eventWhen, priceRange } from "./format";

/** EVT-02 list row (mockup 70): date block, title, time, place, price. */
export function EventCard({ e, showStatus }: { e: Card; showStatus?: boolean }) {
  const d = dayBadge(e.startsAt);
  return (
    <Link href={`/events/${e.id}`} className="pressable flex gap-3 rounded-[var(--radius-card)] border border-line bg-surface p-3 shadow-card">
      <div className="relative size-[84px] shrink-0 overflow-hidden rounded-2xl bg-primary-soft">
        {e.coverUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={e.coverUrl} alt="" className="size-full object-cover" loading="lazy" />
        ) : (
          <span className="grid size-full place-items-center text-primary">
            <span className="text-center leading-none">
              <span className="block text-[26px] font-extrabold">{d.day}</span>
              <span className="block text-[12px] font-bold uppercase">{d.month}</span>
            </span>
          </span>
        )}
      </div>
      <div className="min-w-0 flex-1">
        {showStatus && e.status !== "published" && (
          <div className="mb-1">
            <Badge tone={EVENT_STATUS_TONE[e.status as EventStatus]}>{EVENT_STATUS_LABEL[e.status as EventStatus]}</Badge>
          </div>
        )}
        <p className="line-clamp-2 text-[15px] leading-snug font-bold text-ink">{e.title}</p>
        <p className="mt-0.5 text-[12px] font-semibold text-primary">{eventWhen(e.startsAt, e.endsAt)}</p>
        <p className="mt-0.5 flex items-center gap-1 truncate text-[12px] text-muted">
          {e.mode === "online" ? <Video size={13} /> : <MapPin size={13} />}
          <span className="truncate">{e.mode === "online" ? MODES.online : e.location}</span>
        </p>
        <div className="mt-1 flex items-center justify-between gap-2 text-[12px]">
          <span className="font-bold text-ink">{priceRange(e.minPrice, e.maxPrice)}</span>
          <span className="flex items-center gap-1 text-muted">
            <Users size={13} /> {e.attendees}
          </span>
        </div>
      </div>
    </Link>
  );
}

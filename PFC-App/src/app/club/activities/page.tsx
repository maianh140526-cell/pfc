"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { CalendarDays, MapPin, Plus, Ticket, Users } from "lucide-react";
import { useEffect, useState } from "react";
import { useClub } from "@/modules/club/session";
import { fmtDateTime, toDate } from "@/modules/club/types";
import { AppHeader, Badge, ButtonLink, Card, EmptyState, FabLink, SegmentedTabs } from "@/ui";

const STATUS: Record<string, { label: string; tone: "primary" | "income" | "muted" | "warning" }> = {
  draft: { label: "Nháp", tone: "muted" },
  active: { label: "Đang mở", tone: "income" },
  completed: { label: "Đã xong", tone: "primary" },
  archived: { label: "Lưu trữ", tone: "muted" },
};

type EventCard = {
  id: string;
  title: string;
  summary: string;
  status: string;
  coverUrl: string | null;
  startsAt: string;
  mode: string;
  location: string;
  attendees: number;
  capacity: number | null;
  minPrice: number;
  maxPrice: number;
  registered: boolean;
};
const EVENT_STATUS: Record<string, { label: string; tone: "primary" | "income" | "muted" | "warning" | "expense" }> = {
  draft: { label: "Nháp", tone: "muted" },
  submitted: { label: "Chờ duyệt", tone: "warning" },
  published: { label: "Đang mở đăng ký", tone: "income" },
  rejected: { label: "Bị từ chối", tone: "expense" },
  cancelled: { label: "Đã hủy", tone: "expense" },
  completed: { label: "Đã kết thúc", tone: "primary" },
};
const vnd = (n: number) => `${n.toLocaleString("vi-VN")}₫`;
const localWhen = (s: string) => `${s.slice(11, 16)} ${s.slice(8, 10)}/${s.slice(5, 7)}/${s.slice(0, 4)}`;

function Cover({ src, alt }: { src: string | null | undefined; alt: string }) {
  if (!src) return null;
  // eslint-disable-next-line @next/next/no-img-element
  return <img src={src} alt={alt} className="mb-3 aspect-[16/9] w-full rounded-xl object-cover" loading="lazy" />;
}

/** FR-CLB-007 Activities (internal) + FR-CLB-010 Club events (PFC Sự kiện linked to the Club), mockup 108/118. */
export default function ClubActivitiesPage() {
  const { home, can } = useClub();
  const params = useSearchParams();
  const [tab, setTab] = useState<"activities" | "events">(params.get("tab") === "events" ? "events" : "activities");
  const canManage = can("manage_activities");
  const canLink = can("link_events");
  const activities = [...home.activities]
    .filter((a) => canManage || a.status !== "draft")
    .sort((a, b) => (toDate(b.startsAt)?.getTime() ?? 0) - (toDate(a.startsAt)?.getTime() ?? 0));

  const ids = home.links.map((l) => l.externalEventId).filter(Boolean);
  const [events, setEvents] = useState<EventCard[] | null>(null);
  useEffect(() => {
    if (!ids.length) return setEvents([]);
    let alive = true;
    fetch(`/api/events/cards?ids=${encodeURIComponent(ids.join(","))}`, { cache: "no-store" })
      .then((r) => r.json())
      .then((j: { events?: EventCard[] }) => alive && setEvents(j.events ?? []))
      .catch(() => alive && setEvents([]));
    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ids.join(",")]);

  return (
    <>
      <AppHeader title="Hoạt động" backHref="/club" />
      <div className="px-4">
        <SegmentedTabs
          label="Loại"
          stretch
          value={tab}
          onChange={setTab}
          options={[
            { value: "activities", label: `Hoạt động (${activities.length})` },
            { value: "events", label: `Sự kiện (${events?.length ?? "…"})` },
          ]}
        />
      </div>

      {tab === "activities" ? (
        activities.length === 0 ? (
          <EmptyState
            icon={CalendarDays}
            title="Chưa có hoạt động"
            description="Hoạt động nội bộ của CLB (họp, workshop, chiến dịch…) sẽ hiện ở đây."
            action={canManage ? <ButtonLink href="/club/activities/new" block>Tạo hoạt động</ButtonLink> : undefined}
          />
        ) : (
          <ul className="space-y-3 px-4 pt-3 pb-4">
            {activities.map((a) => {
              const s = STATUS[a.status] ?? { label: a.status, tone: "muted" as const };
              return (
                <li key={a.id}>
                  <Link href={`/club/activities/${a.id}`} className="pressable block">
                    <Card>
                      <Cover src={a.coverUrl ?? a.mediaUrls?.[0]} alt={a.title} />
                      <div className="flex items-start justify-between gap-2">
                        <span className="text-[15px] font-bold text-ink">{a.title}</span>
                        <Badge tone={s.tone}>{s.label}</Badge>
                      </div>
                      <ul className="mt-2 space-y-1 text-[13px] text-muted">
                        <li className="flex items-center gap-1.5">
                          <CalendarDays size={14} /> {a.startsAt ? fmtDateTime(a.startsAt) : "Chưa có lịch"}
                        </li>
                        {a.location && (
                          <li className="flex items-center gap-1.5">
                            <MapPin size={14} /> {a.location}
                          </li>
                        )}
                        {a.participantCount != null && (
                          <li className="flex items-center gap-1.5">
                            <Users size={14} /> {a.participantCount}
                            {a.capacity ? `/${a.capacity}` : ""} người tham gia
                          </li>
                        )}
                      </ul>
                    </Card>
                  </Link>
                </li>
              );
            })}
          </ul>
        )
      ) : (
        <div className="px-4 pt-3 pb-4">
          {canLink && (
            <ButtonLink href="/events/new?club=1" variant="secondary" block>
              <Plus size={18} /> Tạo sự kiện của CLB
            </ButtonLink>
          )}
          {events === null ? (
            <p className="pt-4 text-center text-[14px] text-muted">Đang tải sự kiện…</p>
          ) : events.length === 0 ? (
            <EmptyState icon={Ticket} title="Chưa có sự kiện" description="Sự kiện của CLB có ảnh, vé, đăng ký và check-in QR. Ban điều hành / Ban Sự kiện tạo sự kiện ở đây." />
          ) : (
            <ul className="mt-3 space-y-3">
              {events.map((e) => {
                const s = EVENT_STATUS[e.status] ?? { label: e.status, tone: "muted" as const };
                return (
                  <li key={e.id}>
                    <Link href={`/events/${e.id}`} className="pressable block">
                      <Card>
                        <Cover src={e.coverUrl} alt={e.title} />
                        <div className="flex items-start justify-between gap-2">
                          <span className="text-[15px] font-bold text-ink">{e.title}</span>
                          <Badge tone={s.tone}>{s.label}</Badge>
                        </div>
                        {e.summary && <p className="mt-1 text-[13px] text-ink-2">{e.summary}</p>}
                        <ul className="mt-2 space-y-1 text-[13px] text-muted">
                          <li className="flex items-center gap-1.5">
                            <CalendarDays size={14} /> {localWhen(e.startsAt)}
                          </li>
                          {e.mode !== "online" && e.location && (
                            <li className="flex items-center gap-1.5">
                              <MapPin size={14} /> {e.location}
                            </li>
                          )}
                          <li className="flex items-center gap-1.5">
                            <Users size={14} /> {e.attendees}
                            {e.capacity ? `/${e.capacity}` : ""} đã đăng ký · {e.maxPrice === 0 ? "Miễn phí" : e.minPrice === e.maxPrice ? vnd(e.minPrice) : `${vnd(e.minPrice)} – ${vnd(e.maxPrice)}`}
                          </li>
                        </ul>
                        {e.registered && <p className="mt-2 text-[13px] font-semibold text-income">Bạn đã đăng ký</p>}
                      </Card>
                    </Link>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      )}
      {tab === "activities" && canManage && <FabLink href="/club/activities/new" label="Tạo hoạt động" />}
    </>
  );
}

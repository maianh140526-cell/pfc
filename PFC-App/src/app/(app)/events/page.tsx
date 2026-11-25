import Link from "next/link";
import { CalendarDays, ClipboardCheck, Ticket } from "lucide-react";
import { currentMember, toActor } from "@/platform/auth/session";
import { can } from "@/platform/roles";
import { CATEGORIES } from "@/modules/events/domain/events";
import { listEvents } from "@/modules/events/server/service";
import { EventCard } from "@/modules/events/ui/EventCard";
import { AppHeader, EmptyState, FabLink } from "@/ui";
import { FilterChips } from "@/ui/FilterChips";
import { SearchBox } from "@/ui/SearchBox";

export const metadata = { title: "Sự kiện" };
export const dynamic = "force-dynamic";

const TABS = { upcoming: "Sắp diễn ra", online: "Trực tuyến", offline: "Trực tiếp", favorites: "Đã lưu", mine: "Tôi tổ chức", past: "Đã qua" } as const;
type Tab = keyof typeof TABS;

/** EVT-01/02 Events (mockup 70). */
export default async function EventsPage({ searchParams }: { searchParams: Promise<{ tab?: string; category?: string; q?: string }> }) {
  const sp = await searchParams;
  const me = await currentMember();
  const actor = me ? toActor(me) : null;
  const tabs = (Object.keys(TABS) as Tab[]).filter((t) => me || (t !== "favorites" && t !== "mine"));
  const tab: Tab = sp.tab && tabs.includes(sp.tab as Tab) ? (sp.tab as Tab) : "upcoming";
  const events = await listEvents(actor, { tab, category: sp.category, q: sp.q?.slice(0, 80) });
  const qs = (patch: Record<string, string | undefined>) => {
    const p = new URLSearchParams();
    for (const [k, v] of Object.entries({ tab: sp.tab, category: sp.category, q: sp.q, ...patch })) if (v) p.set(k, v);
    return `/events?${p.toString()}`;
  };
  return (
    <>
      <AppHeader
        back
        backFallback="/community"
        title="Sự kiện"
        actions={
          <>
            {actor && can(actor, "event.approve") && (
              <Link href="/events/review" aria-label="Duyệt sự kiện" className="grid size-11 place-items-center rounded-full text-ink active:bg-surface-2">
                <ClipboardCheck size={22} />
              </Link>
            )}
            {me && (
              <Link href="/events/tickets" aria-label="Vé của tôi" className="grid size-11 place-items-center rounded-full text-ink active:bg-surface-2">
                <Ticket size={22} />
              </Link>
            )}
          </>
        }
      />
      <div className="space-y-3 px-4">
        <SearchBox placeholder="Tìm sự kiện, địa điểm…" />
        <FilterChips label="Danh sách" value={tab} hrefFor={(t) => qs({ tab: t === "upcoming" ? undefined : t })} options={tabs.map((t) => ({ value: t, label: TABS[t] }))} />
        <FilterChips
          label="Loại sự kiện"
          value={sp.category && sp.category in CATEGORIES ? sp.category : ""}
          hrefFor={(c) => qs({ category: c || undefined })}
          options={[{ value: "", label: "Tất cả" }, ...Object.entries(CATEGORIES).map(([value, label]) => ({ value, label }))]}
        />
      </div>
      {events.length === 0 ? (
        <EmptyState
          icon={CalendarDays}
          title={tab === "mine" ? "Bạn chưa tổ chức sự kiện nào" : "Chưa có sự kiện"}
          description={tab === "mine" ? "Tạo sự kiện, thêm loại vé rồi gửi Ban Sự kiện duyệt." : "Thử bộ lọc khác hoặc quay lại sau."}
        />
      ) : (
        <ul className="space-y-3 px-4 pt-3 pb-4">
          {events.map((e) => (
            <li key={e.id}>
              <EventCard e={e} showStatus={tab === "mine"} />
            </li>
          ))}
        </ul>
      )}
      {me && <FabLink href="/events/new" label="Tạo sự kiện" />}
    </>
  );
}

import { NextResponse, type NextRequest } from "next/server";
import { currentMember, toActor } from "@/platform/auth/session";
import { getEvent } from "@/modules/events/server/service";

export const dynamic = "force-dynamic";

/**
 * Event cards for ids a Club has linked (Club → "Sự kiện" tab). Same visibility as the event page:
 * drafts only for their organizer / approvers; unknown or hidden ids are simply left out.
 */
export async function GET(req: NextRequest) {
  const me = await currentMember();
  const actor = me ? toActor(me) : null;
  const ids = [...new Set((req.nextUrl.searchParams.get("ids") ?? "").split(",").map((s) => s.trim()).filter((s) => /^[0-9a-f-]{36}$/.test(s)))].slice(0, 30);
  const events = [];
  for (const id of ids) {
    const e = await getEvent(actor, id);
    if (!e) continue;
    events.push({
      id: e.id,
      title: e.title,
      summary: e.summary,
      status: e.status,
      coverUrl: e.coverUrl,
      startsAt: e.startsAt,
      endsAt: e.endsAt,
      mode: e.mode,
      location: e.location,
      attendees: e.attendees,
      capacity: e.capacity,
      minPrice: e.minPrice,
      maxPrice: e.maxPrice,
      registered: !!e.my && (e.my.status === "confirmed" || e.my.status === "pending_payment"),
    });
  }
  return NextResponse.json({ events }, { headers: { "cache-control": "no-store" } });
}

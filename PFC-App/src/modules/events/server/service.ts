import "server-only";
import { awardPoints } from "@/modules/rewards/server/service";
import { assertAllowed } from "@/platform/admin/restrictions";
import { isEnabled } from "@/platform/settings/service";
import { randomBytes, randomUUID } from "node:crypto";
import { z } from "zod";
import { all, one, run, withTransaction } from "@/platform/db/client";
import { audit } from "@/platform/audit";
import { ActionError } from "@/platform/errors";
import { notify } from "@/platform/notifications/service";
import { can, type Actor } from "@/platform/roles";
import { verifyOwnUploadUrls } from "@/platform/uploads/service";
import { PAYMENT_TTL_MIN, autoRefund, createPayment, onlinePaymentEnabled } from "@/modules/payments/server/service";
import {
  CATEGORIES,
  MODES,
  applyEventAction,
  availableEventActions,
  isLocal,
  parseTicket,
  registrationOpen,
  validateSchedule,
  validateTickets,
  vnLocal,
  type EventAction,
  type EventCategory,
  type EventMode,
  type EventStatus,
} from "../domain/events";

/** Shared Event Engine (G4). Every permission is checked here. */
const now = () => new Date().toISOString();
const nowLocal = () => vnLocal(new Date());
const canApprove = (a: Actor | null) => can(a, "event.approve");
const ticketCode = () => {
  const abc = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  return Array.from(randomBytes(12), (b) => abc[b % abc.length]).join("");
};
const parseJson = <T,>(raw: string, fb: T): T => {
  try {
    return JSON.parse(raw) as T;
  } catch {
    return fb;
  }
};

type Row = {
  id: string;
  organizer_id: string;
  group_id: string | null;
  title: string;
  summary: string;
  description: string;
  category: EventCategory;
  mode: EventMode;
  location: string;
  online_url: string | null;
  starts_at: string;
  ends_at: string;
  registration_deadline: string | null;
  cover_url: string | null;
  capacity: number | null;
  pay_at_door: number;
  agenda: string;
  speakers: string;
  status: EventStatus;
  reject_reason: string | null;
  cancel_reason: string | null;
  created_at: string;
};
async function eventRow(id: string) {
  return one<Row>("SELECT * FROM evt_events WHERE id = ?", [id]);
}

const optInt = (min: number) => z.preprocess((v) => (v === "" || v === null || v === undefined ? null : v), z.union([z.null(), z.coerce.number().int().min(min)]));
const ticketSchema = z.object({ name: z.string().trim().min(1).max(60), description: z.string().trim().max(200).default(""), price: z.coerce.number().int(), capacity: optInt(0) });
const eventSchema = z.object({
  title: z.string().trim().min(5, "Tên sự kiện tối thiểu 5 ký tự.").max(120),
  summary: z.string().trim().max(200).default(""),
  description: z.string().trim().max(8000).default(""),
  category: z.enum(Object.keys(CATEGORIES) as [EventCategory, ...EventCategory[]]).default("other"),
  mode: z.enum(Object.keys(MODES) as [EventMode, ...EventMode[]]).default("offline"),
  location: z.string().trim().max(200).default(""),
  onlineUrl: z.string().trim().max(500).default(""),
  startsAt: z.string(),
  endsAt: z.string(),
  deadline: z.string().nullable().optional(),
  coverUrl: z.string().nullable().optional(),
  capacity: optInt(1),
  payAtDoor: z.boolean().default(false),
  agenda: z.array(z.object({ time: z.string().max(20), title: z.string().trim().min(1).max(120) })).max(20).default([]),
  speakers: z.array(z.object({ name: z.string().trim().min(1).max(80), title: z.string().trim().max(120).default("") })).max(20).default([]),
  tickets: z.array(ticketSchema).default([]),
});

async function validated(actor: Actor, input: unknown) {
  const d = eventSchema.parse(input);
  const deadline = d.deadline && isLocal(d.deadline) ? d.deadline : null;
  const err = validateSchedule(d.startsAt, d.endsAt, deadline, nowLocal()) ?? validateTickets(d.tickets);
  if (err) throw new ActionError(err);
  if (d.mode !== "online" && d.location.length < 5) throw new ActionError("Nhập địa điểm tổ chức.");
  let onlineUrl: string | null = null;
  if (d.mode !== "offline") {
    try {
      const u = new URL(d.onlineUrl);
      if (u.protocol !== "https:") throw new Error();
      onlineUrl = u.toString();
    } catch {
      throw new ActionError("Link tham gia trực tuyến phải là https://");
    }
  }
  const [cover] = d.coverUrl ? await verifyOwnUploadUrls(actor, "event", [d.coverUrl], 1).catch(async () => verifyOwnUploadUrls(actor, "post", [d.coverUrl!], 1)) : [null];
  return { ...d, deadline, onlineUrl, cover: cover ?? null };
}

/** EVT-05 Create Event (draft). Any member may organize; publishing needs approval (event.approve). */
export async function createEvent(actor: Actor, input: unknown): Promise<string> {
  await assertAllowed(actor.id, "events_host", "events");
  const d = await validated(actor, input);
  const id = randomUUID();
  const t = now();
  await run(
    `INSERT INTO evt_events (id, organizer_id, title, summary, description, category, mode, location, online_url, starts_at, ends_at, registration_deadline, cover_url, capacity, pay_at_door, agenda, speakers, status, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'draft', ?, ?)`,
    [id, actor.id, d.title, d.summary, d.description, d.category, d.mode, d.location, d.onlineUrl, d.startsAt, d.endsAt, d.deadline, d.cover, d.capacity, d.payAtDoor ? 1 : 0, JSON.stringify(d.agenda), JSON.stringify(d.speakers), t, t],
  );
  for (const [i, tk] of d.tickets.entries()) {
    await run("INSERT INTO evt_ticket_types (id, event_id, name, description, price, capacity, position) VALUES (?, ?, ?, ?, ?, ?, ?)", [randomUUID(), id, tk.name, tk.description, tk.price, tk.capacity, i]);
  }
  return id;
}

/** EVT-06 Edit. Ticket types can only change while nobody has registered. */
export async function updateEvent(actor: Actor, id: string, input: unknown): Promise<void> {
  const e = await eventRow(id);
  if (!e) throw new ActionError("Không tìm thấy sự kiện.");
  if (e.organizer_id !== actor.id) throw new ActionError("Chỉ người tổ chức sửa được sự kiện.");
  if (e.status === "cancelled" || e.status === "completed" || e.status === "submitted") throw new ActionError("Không sửa được sự kiện ở trạng thái này.");
  const d = await validated(actor, input);
  const regs = await one<{ n: number }>("SELECT COUNT(*) AS n FROM evt_registrations WHERE event_id = ?", [id]);
  await run(
    `UPDATE evt_events SET title = ?, summary = ?, description = ?, category = ?, mode = ?, location = ?, online_url = ?, starts_at = ?, ends_at = ?, registration_deadline = ?, cover_url = ?, capacity = ?, pay_at_door = ?, agenda = ?, speakers = ?, updated_at = ? WHERE id = ?`,
    [d.title, d.summary, d.description, d.category, d.mode, d.location, d.onlineUrl, d.startsAt, d.endsAt, d.deadline, d.cover, d.capacity, d.payAtDoor ? 1 : 0, JSON.stringify(d.agenda), JSON.stringify(d.speakers), now(), id],
  );
  if (Number(regs?.n ?? 0) === 0) {
    await run("DELETE FROM evt_ticket_types WHERE event_id = ?", [id]);
    for (const [i, tk] of d.tickets.entries()) {
      await run("INSERT INTO evt_ticket_types (id, event_id, name, description, price, capacity, position) VALUES (?, ?, ?, ?, ?, ?, ?)", [randomUUID(), id, tk.name, tk.description, tk.price, tk.capacity, i]);
    }
  }
  if (e.status === "published") {
    const people = await all<{ member_id: string }>("SELECT member_id FROM evt_registrations WHERE event_id = ? AND status = 'confirmed'", [id]);
    if (e.starts_at !== d.startsAt || e.location !== d.location) {
      await notify(people.map((p) => p.member_id), { category: "events", title: `Sự kiện “${d.title.slice(0, 50)}” vừa thay đổi thời gian / địa điểm`, href: `/events/${id}` });
    }
  }
}

export async function eventTransition(actor: Actor, id: string, action: EventAction, reason?: string): Promise<EventStatus> {
  const e = await eventRow(id);
  if (!e) throw new ActionError("Không tìm thấy sự kiện.");
  if (action === "submit" && Number((await one<{ n: number }>("SELECT COUNT(*) AS n FROM evt_ticket_types WHERE event_id = ?", [id]))?.n ?? 0) === 0) {
    throw new ActionError("Thêm ít nhất một loại vé trước khi gửi duyệt.");
  }
  const r = applyEventAction(action, e.status, { isOrganizer: e.organizer_id === actor.id, canApprove: canApprove(actor) }, reason);
  if (!r.ok) throw new ActionError(r.error);
  const n = await run(
    "UPDATE evt_events SET status = ?, reject_reason = ?, cancel_reason = ?, published_at = CASE WHEN ? = 'published' THEN COALESCE(published_at, ?) ELSE published_at END, updated_at = ? WHERE id = ? AND status = ?",
    [r.to, r.to === "rejected" ? reason!.trim() : null, r.to === "cancelled" ? reason!.trim() : null, r.to, now(), now(), id, e.status],
  );
  if (n !== 1) throw new ActionError("Sự kiện vừa được cập nhật. Tải lại trang.");
  await audit(actor.id, `event.${action}`, `event:${id}`, "success");
  if (e.organizer_id !== actor.id && (r.to === "published" || r.to === "rejected" || r.to === "cancelled")) {
    const verb = r.to === "published" ? "đã được duyệt và mở đăng ký" : r.to === "rejected" ? "bị từ chối" : "đã bị hủy";
    await notify(e.organizer_id, { category: "events", title: `Sự kiện “${e.title.slice(0, 50)}” ${verb}`, body: reason?.trim() ? `Lý do: ${reason.trim().slice(0, 200)}` : "", href: `/events/${id}` });
  }
  if (r.to === "cancelled") {
    // Everyone registered is told; paid tickets are refunded automatically.
    const regs = await all<{ id: string; member_id: string; status: string; paid: number }>("SELECT id, member_id, status, paid FROM evt_registrations WHERE event_id = ? AND status IN ('confirmed','pending_payment')", [id]);
    await run("UPDATE evt_registrations SET status = 'cancelled', cancel_reason = 'Sự kiện bị hủy', updated_at = ? WHERE event_id = ? AND status = 'pending_payment'", [now(), id]);
    for (const g of regs) if (g.status === "confirmed" && Number(g.paid)) await autoRefund("evt_registration", g.id, "event_cancelled", actor.id);
    await run("UPDATE evt_registrations SET status = 'cancelled', cancel_reason = 'Sự kiện bị hủy', updated_at = ? WHERE event_id = ? AND status = 'confirmed'", [now(), id]);
    await notify([...new Set(regs.map((g) => g.member_id))], { category: "events", title: `Sự kiện “${e.title.slice(0, 50)}” đã bị hủy`, body: `Lý do: ${reason!.trim().slice(0, 200)}. Vé đã thanh toán trực tuyến được hoàn tiền tự động.`, href: `/events/${id}` });
  }
  return r.to;
}

// ───────────────────────── Reading ─────────────────────────

export type EventCard = { id: string; title: string; summary: string; category: EventCategory; mode: EventMode; location: string; startsAt: string; endsAt: string; coverUrl: string | null; minPrice: number; maxPrice: number; attendees: number; status: EventStatus; favorite: boolean };

const CARD_SQL = `SELECT e.*, (SELECT MIN(price) FROM evt_ticket_types t WHERE t.event_id = e.id) AS min_price, (SELECT MAX(price) FROM evt_ticket_types t WHERE t.event_id = e.id) AS max_price,
  (SELECT COUNT(*) FROM evt_registrations r WHERE r.event_id = e.id AND r.status = 'confirmed') AS attendees,
  EXISTS (SELECT 1 FROM evt_favorites f WHERE f.event_id = e.id AND f.member_id = ?) AS favorite FROM evt_events e`;
type CardRow = Row & { min_price: number | null; max_price: number | null; attendees: number; favorite: number };
const toCard = (r: CardRow): EventCard => ({
  id: r.id,
  title: r.title,
  summary: r.summary,
  category: r.category,
  mode: r.mode,
  location: r.location,
  startsAt: r.starts_at,
  endsAt: r.ends_at,
  coverUrl: r.cover_url,
  minPrice: Number(r.min_price ?? 0),
  maxPrice: Number(r.max_price ?? 0),
  attendees: Number(r.attendees),
  status: r.status,
  favorite: !!r.favorite,
});

/** EVT-01/02/04 Discovery & list (mockup 70). */
export async function listEvents(actor: Actor | null, f: { tab?: "upcoming" | "online" | "offline" | "past" | "favorites" | "mine"; q?: string; category?: string } = {}): Promise<EventCard[]> {
  const me = actor?.id ?? "";
  const where: string[] = [];
  const args: (string | number)[] = [me];
  if (f.tab === "mine") (where.push("e.organizer_id = ?"), args.push(me));
  else if (f.tab === "past") where.push("e.status IN ('completed','published') AND e.ends_at < ?"), args.push(nowLocal());
  else where.push("e.status = 'published' AND e.ends_at >= ?"), args.push(nowLocal());
  if (f.tab === "online") where.push("e.mode IN ('online','hybrid')");
  if (f.tab === "offline") where.push("e.mode IN ('offline','hybrid')");
  if (f.tab === "favorites") (where.push("EXISTS (SELECT 1 FROM evt_favorites f WHERE f.event_id = e.id AND f.member_id = ?)"), args.push(me));
  if (f.category && f.category in CATEGORIES) (where.push("e.category = ?"), args.push(f.category));
  if (f.q?.trim()) {
    const L = `%${f.q.trim().replace(/[\\%_]/g, (m) => `\\${m}`)}%`;
    where.push("(e.title LIKE ? ESCAPE '\\' OR e.summary LIKE ? ESCAPE '\\' OR e.location LIKE ? ESCAPE '\\')");
    args.push(L, L, L);
  }
  const order = f.tab === "past" ? "e.starts_at DESC" : f.tab === "mine" ? "e.created_at DESC" : "e.starts_at ASC";
  return (await all<CardRow>(`${CARD_SQL} WHERE ${where.join(" AND ")} ORDER BY ${order} LIMIT 100`, args)).map(toCard);
}

export type TicketType = { id: string; name: string; description: string; price: number; capacity: number | null; left: number | null };

async function ticketTypes(eventId: string): Promise<TicketType[]> {
  const cutoff = now();
  const rows = await all<{ id: string; name: string; description: string; price: number; capacity: number | null; used: number }>(
    `SELECT t.*, (SELECT COUNT(*) FROM evt_registrations r WHERE r.ticket_type_id = t.id AND (r.status = 'confirmed' OR (r.status = 'pending_payment' AND r.hold_until > ?))) AS used
     FROM evt_ticket_types t WHERE t.event_id = ? ORDER BY t.position`,
    [cutoff, eventId],
  );
  return rows.map((r) => ({ id: r.id, name: r.name, description: r.description, price: Number(r.price), capacity: r.capacity === null ? null : Number(r.capacity), left: r.capacity === null ? null : Math.max(0, Number(r.capacity) - Number(r.used)) }));
}

async function seatsUsed(eventId: string): Promise<number> {
  return Number((await one<{ n: number }>("SELECT COUNT(*) AS n FROM evt_registrations WHERE event_id = ? AND (status = 'confirmed' OR (status = 'pending_payment' AND hold_until > ?))", [eventId, now()]))?.n ?? 0);
}

export type MyRegistration = { id: string; status: string; ticketName: string; price: number; paid: boolean; ticketCode: string; holdUntil: string | null; checkedInAt: string | null };

export type EventDetail = EventCard & {
  description: string;
  organizerId: string;
  organizerName: string;
  onlineUrl: string | null;
  deadline: string | null;
  capacity: number | null;
  seatsLeft: number | null;
  payAtDoor: boolean;
  agenda: { time: string; title: string }[];
  speakers: { name: string; title: string }[];
  tickets: TicketType[];
  rejectReason: string | null;
  cancelReason: string | null;
  isOrganizer: boolean;
  canManage: boolean;
  actions: EventAction[];
  my: MyRegistration | null;
  registrationError: string | null;
  onlinePayments: boolean;
};

/** EVT-03 Event Detail (mockup 71). The online join link is only shown to confirmed attendees and organizers. */
export async function getEvent(actor: Actor | null, id: string): Promise<EventDetail | null> {
  const r = await one<CardRow & { organizer_name: string }>(`${CARD_SQL.replace("FROM evt_events e", ", m.full_name AS organizer_name FROM evt_events e JOIN members m ON m.id = e.organizer_id")} WHERE e.id = ?`, [actor?.id ?? "", id]);
  if (!r) return null;
  const isOrganizer = !!actor && r.organizer_id === actor.id;
  const manage = isOrganizer || canApprove(actor);
  if (!["published", "completed", "cancelled"].includes(r.status) && !manage) return null;
  const my = actor
    ? await one<{ id: string; status: string; name: string; price: number; paid: number; ticket_code: string; hold_until: string | null; checked_in_at: string | null }>(
        `SELECT r.id, r.status, t.name, r.price, r.paid, r.ticket_code, r.hold_until, r.checked_in_at FROM evt_registrations r JOIN evt_ticket_types t ON t.id = r.ticket_type_id
         WHERE r.event_id = ? AND r.member_id = ? ORDER BY r.created_at DESC LIMIT 1`,
        [id, actor.id],
      )
    : null;
  const tickets = await ticketTypes(id);
  const used = await seatsUsed(id);
  const seatsLeft = r.capacity === null ? null : Math.max(0, Number(r.capacity) - used);
  let registrationError = registrationOpen({ status: r.status, startsAt: r.starts_at, deadline: r.registration_deadline }, nowLocal());
  if (!registrationError && seatsLeft === 0) registrationError = "Sự kiện đã đủ chỗ.";
  const confirmed = my?.status === "confirmed";
  return {
    ...toCard(r),
    description: r.description,
    organizerId: r.organizer_id,
    organizerName: r.organizer_name,
    onlineUrl: confirmed || manage ? r.online_url : null,
    deadline: r.registration_deadline,
    capacity: r.capacity,
    seatsLeft,
    payAtDoor: !!r.pay_at_door,
    agenda: parseJson(r.agenda, []),
    speakers: parseJson(r.speakers, []),
    tickets,
    rejectReason: r.reject_reason,
    cancelReason: r.cancel_reason,
    isOrganizer,
    canManage: manage,
    actions: availableEventActions(r.status, { isOrganizer, canApprove: canApprove(actor) }),
    my: my ? { id: my.id, status: my.status, ticketName: my.name, price: Number(my.price), paid: !!my.paid, ticketCode: my.ticket_code, holdUntil: my.hold_until, checkedInAt: my.checked_in_at } : null,
    registrationError,
    onlinePayments: onlinePaymentEnabled(),
  };
}

export async function toggleFavorite(actor: Actor, eventId: string): Promise<boolean> {
  if (await run("DELETE FROM evt_favorites WHERE event_id = ? AND member_id = ?", [eventId, actor.id])) return false;
  if (!(await one("SELECT 1 AS x FROM evt_events WHERE id = ? AND status = 'published'", [eventId]))) throw new ActionError("Không tìm thấy sự kiện.");
  await run("INSERT INTO evt_favorites (event_id, member_id, created_at) VALUES (?, ?, ?)", [eventId, actor.id, now()]);
  return true;
}

// ───────────────────────── Registration & tickets ─────────────────────────

const regSchema = z.object({
  ticketTypeId: z.string().min(1, "Chọn loại vé."),
  name: z.string().trim().min(2, "Nhập họ tên người tham dự.").max(80),
  email: z.string().trim().toLowerCase().email("Email không hợp lệ."),
  phone: z
    .string()
    .trim()
    .transform((v) => v.replace(/[\s.-]/g, ""))
    .refine((v) => v === "" || /^(\+84|0)\d{9,10}$/.test(v), "Số điện thoại không hợp lệ.")
    .default(""),
});

/**
 * EVT-07/08/09 Register (mockup 72). Free / pay-at-door → confirmed at once. Paid online → seat held for
 * 15 minutes while the member pays through VNPAY. Capacity is checked inside one write transaction.
 */
export async function register(actor: Actor, eventId: string, input: unknown, ipAddr: string): Promise<{ registrationId: string; payUrl: string | null }> {
  if (!(await isEnabled("events"))) throw new ActionError("Sự kiện đang tạm tắt.");
  const d = regSchema.parse(input);
  const e = await eventRow(eventId);
  if (!e) throw new ActionError("Không tìm thấy sự kiện.");
  const closed = registrationOpen({ status: e.status, startsAt: e.starts_at, deadline: e.registration_deadline }, nowLocal());
  if (closed) throw new ActionError(closed);
  const tt = await one<{ id: string; price: number; capacity: number | null; name: string }>("SELECT id, price, capacity, name FROM evt_ticket_types WHERE id = ? AND event_id = ?", [d.ticketTypeId, eventId]);
  if (!tt) throw new ActionError("Loại vé không hợp lệ.");
  const price = Number(tt.price);
  const online = price > 0 && !e.pay_at_door;
  if (online && !onlinePaymentEnabled()) throw new ActionError("Vé có phí cần thanh toán trực tuyến, nhưng cổng thanh toán chưa được bật.");
  const id = randomUUID();
  const t = now();
  const hold = online ? new Date(Date.now() + PAYMENT_TTL_MIN * 60_000).toISOString() : null;
  await withTransaction(async (tx) => {
    const mine = await tx.execute("SELECT 1 FROM evt_registrations WHERE event_id = ? AND member_id = ? AND (status = 'confirmed' OR (status = 'pending_payment' AND hold_until > ?))", [eventId, actor.id, t]);
    if (mine.rows.length) throw new ActionError("Bạn đã đăng ký sự kiện này.");
    // Stale holds of this member are closed so the unique index allows a fresh registration.
    await tx.execute("UPDATE evt_registrations SET status = 'cancelled', cancel_reason = 'Hết thời gian giữ chỗ', updated_at = ? WHERE event_id = ? AND member_id = ? AND status = 'pending_payment'", [t, eventId, actor.id]);
    const usedType = Number((await tx.execute("SELECT COUNT(*) AS n FROM evt_registrations WHERE ticket_type_id = ? AND (status = 'confirmed' OR (status = 'pending_payment' AND hold_until > ?))", [tt.id, t])).rows[0].n);
    if (tt.capacity !== null && usedType >= Number(tt.capacity)) throw new ActionError(`Vé “${tt.name}” đã hết.`);
    const usedAll = Number((await tx.execute("SELECT COUNT(*) AS n FROM evt_registrations WHERE event_id = ? AND (status = 'confirmed' OR (status = 'pending_payment' AND hold_until > ?))", [eventId, t])).rows[0].n);
    if (e.capacity !== null && usedAll >= Number(e.capacity)) throw new ActionError("Sự kiện đã đủ chỗ.");
    await tx.execute(
      `INSERT INTO evt_registrations (id, event_id, member_id, ticket_type_id, status, price, paid, attendee_name, attendee_email, attendee_phone, ticket_code, hold_until, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [id, eventId, actor.id, tt.id, online ? "pending_payment" : "confirmed", price, price === 0 ? 1 : 0, d.name, d.email, d.phone, ticketCode(), hold, t, t],
    );
  });
  if (!online) {
    await notify(actor.id, { category: "events", title: `Đăng ký thành công: ${e.title.slice(0, 60)}`, body: `${e.starts_at.replace("T", " ")} · ${e.mode === "online" ? "Trực tuyến" : e.location}`, href: `/events/tickets/${id}` });
    await notify(e.organizer_id, { category: "events", title: `Có người đăng ký “${e.title.slice(0, 50)}”`, body: d.name, href: `/events/${eventId}/manage`, dedupeKey: `evt-reg:${id}` });
    return { registrationId: id, payUrl: null };
  }
  const pay = await createPayment(actor.id, {
    purpose: "evt_ticket",
    description: `Vé ${e.title}`.slice(0, 180),
    returnPath: `/events/tickets/${id}`,
    items: [{ refType: "evt_registration", refId: id, payeeId: e.organizer_id, amount: price }],
    ipAddr,
  });
  return { registrationId: id, payUrl: pay.payUrl };
}

/** Resume paying a held seat (e.g. the member closed the VNPAY page). */
export async function resumePayment(actor: Actor, registrationId: string, ipAddr: string): Promise<string> {
  const r = await one<{ event_id: string; member_id: string; status: string; price: number; hold_until: string | null; title: string; organizer_id: string }>(
    "SELECT r.event_id, r.member_id, r.status, r.price, r.hold_until, e.title, e.organizer_id FROM evt_registrations r JOIN evt_events e ON e.id = r.event_id WHERE r.id = ?",
    [registrationId],
  );
  if (!r || r.member_id !== actor.id) throw new ActionError("Không tìm thấy vé.");
  if (r.status !== "pending_payment" || !r.hold_until || r.hold_until <= now()) throw new ActionError("Hết thời gian giữ chỗ. Hãy đăng ký lại.");
  const pay = await createPayment(actor.id, {
    purpose: "evt_ticket",
    description: `Vé ${r.title}`.slice(0, 180),
    returnPath: `/events/tickets/${registrationId}`,
    items: [{ refType: "evt_registration", refId: registrationId, payeeId: r.organizer_id, amount: Number(r.price) }],
    ipAddr,
  });
  await run("UPDATE evt_registrations SET hold_until = ?, updated_at = ? WHERE id = ?", [pay.expiresAt, now(), registrationId]);
  return pay.payUrl;
}

/** Attendee cancels a free / pay-at-door ticket before the event. Paid-online tickets go through a refund request. */
export async function cancelRegistration(actor: Actor, registrationId: string): Promise<void> {
  const r = await one<{ member_id: string; status: string; paid: number; price: number; starts_at: string }>(
    "SELECT r.member_id, r.status, r.paid, r.price, e.starts_at FROM evt_registrations r JOIN evt_events e ON e.id = r.event_id WHERE r.id = ?",
    [registrationId],
  );
  if (!r || r.member_id !== actor.id) throw new ActionError("Không tìm thấy vé.");
  if (r.status === "pending_payment") {
    await run("UPDATE evt_registrations SET status = 'cancelled', cancel_reason = 'Người tham dự hủy', updated_at = ? WHERE id = ?", [now(), registrationId]);
    return;
  }
  if (r.status !== "confirmed") throw new ActionError("Vé không còn hiệu lực.");
  if (r.starts_at <= nowLocal()) throw new ActionError("Sự kiện đã bắt đầu.");
  if (Number(r.price) > 0 && Number(r.paid)) throw new ActionError("Vé đã thanh toán trực tuyến: hãy gửi yêu cầu hoàn tiền.");
  await run("UPDATE evt_registrations SET status = 'cancelled', cancel_reason = 'Người tham dự hủy', updated_at = ? WHERE id = ?", [now(), registrationId]);
}

export type TicketView = MyRegistration & { eventId: string; eventTitle: string; startsAt: string; endsAt: string; location: string; mode: EventMode; onlineUrl: string | null; attendeeName: string; eventStatus: EventStatus; isMine: boolean };

/** EVT-13/14 My tickets / Ticket detail. Attendee and organizer only. */
export async function getTicket(actor: Actor, registrationId: string): Promise<TicketView | null> {
  const r = await one<{ id: string; member_id: string; status: string; name: string; price: number; paid: number; ticket_code: string; hold_until: string | null; checked_in_at: string | null; event_id: string; title: string; starts_at: string; ends_at: string; location: string; mode: EventMode; online_url: string | null; attendee_name: string; organizer_id: string; event_status: EventStatus }>(
    `SELECT r.*, t.name, e.title, e.starts_at, e.ends_at, e.location, e.mode, e.online_url, e.organizer_id, e.status AS event_status FROM evt_registrations r
     JOIN evt_ticket_types t ON t.id = r.ticket_type_id JOIN evt_events e ON e.id = r.event_id WHERE r.id = ?`,
    [registrationId],
  );
  if (!r || (r.member_id !== actor.id && r.organizer_id !== actor.id && !canApprove(actor))) return null;
  return {
    id: r.id,
    status: r.status,
    ticketName: r.name,
    price: Number(r.price),
    paid: !!r.paid,
    ticketCode: r.ticket_code,
    holdUntil: r.hold_until,
    checkedInAt: r.checked_in_at,
    eventId: r.event_id,
    eventTitle: r.title,
    startsAt: r.starts_at,
    endsAt: r.ends_at,
    location: r.location,
    mode: r.mode,
    onlineUrl: r.status === "confirmed" ? r.online_url : null,
    attendeeName: r.attendee_name,
    eventStatus: r.event_status,
    isMine: r.member_id === actor.id,
  };
}

export async function myTickets(actor: Actor): Promise<(MyRegistration & { eventId: string; eventTitle: string; startsAt: string; location: string; mode: EventMode })[]> {
  const rows = await all<{ id: string; status: string; name: string; price: number; paid: number; ticket_code: string; hold_until: string | null; checked_in_at: string | null; event_id: string; title: string; starts_at: string; location: string; mode: EventMode }>(
    `SELECT r.*, t.name, e.title, e.starts_at, e.location, e.mode FROM evt_registrations r JOIN evt_ticket_types t ON t.id = r.ticket_type_id JOIN evt_events e ON e.id = r.event_id
     WHERE r.member_id = ? AND r.status != 'cancelled' ORDER BY e.starts_at DESC LIMIT 100`,
    [actor.id],
  );
  return rows.map((r) => ({ id: r.id, status: r.status, ticketName: r.name, price: Number(r.price), paid: !!r.paid, ticketCode: r.ticket_code, holdUntil: r.hold_until, checkedInAt: r.checked_in_at, eventId: r.event_id, eventTitle: r.title, startsAt: r.starts_at, location: r.location, mode: r.mode }));
}

// ───────────────────────── Organizer tools (EVT-A01…A05) ─────────────────────────

async function requireManage(actor: Actor, eventId: string) {
  const e = await eventRow(eventId);
  if (!e) throw new ActionError("Không tìm thấy sự kiện.");
  if (e.organizer_id !== actor.id && !canApprove(actor)) throw new ActionError("Chỉ người tổ chức hoặc Ban Sự kiện quản lý sự kiện này.");
  return e;
}

export type Attendee = { id: string; name: string; email: string; phone: string; ticketName: string; price: number; paid: boolean; status: string; checkedInAt: string | null; createdAt: string };

export async function attendees(actor: Actor, eventId: string): Promise<Attendee[]> {
  await requireManage(actor, eventId);
  return (
    await all<{ id: string; attendee_name: string; attendee_email: string; attendee_phone: string; name: string; price: number; paid: number; status: string; checked_in_at: string | null; created_at: string }>(
      `SELECT r.*, t.name FROM evt_registrations r JOIN evt_ticket_types t ON t.id = r.ticket_type_id WHERE r.event_id = ? AND r.status IN ('confirmed','refunded') ORDER BY r.created_at`,
      [eventId],
    )
  ).map((r) => ({ id: r.id, name: r.attendee_name, email: r.attendee_email, phone: r.attendee_phone, ticketName: r.name, price: Number(r.price), paid: !!r.paid, status: r.status, checkedInAt: r.checked_in_at, createdAt: r.created_at }));
}

export async function dashboard(actor: Actor, eventId: string): Promise<{ registered: number; checkedIn: number; revenueOnline: number; revenueDoor: number; byTicket: { name: string; sold: number; capacity: number | null }[] }> {
  await requireManage(actor, eventId);
  const list = await attendees(actor, eventId);
  const confirmed = list.filter((a) => a.status === "confirmed");
  const types = await ticketTypes(eventId);
  return {
    registered: confirmed.length,
    checkedIn: confirmed.filter((a) => a.checkedInAt).length,
    revenueOnline: Number((await one<{ s: number }>("SELECT COALESCE(SUM(i.amount),0) AS s FROM payment_items i JOIN payments p ON p.id = i.payment_id JOIN evt_registrations r ON r.id = i.ref_id WHERE i.ref_type = 'evt_registration' AND r.event_id = ? AND p.status = 'succeeded'", [eventId]))?.s ?? 0),
    revenueDoor: Number((await one<{ s: number }>("SELECT COALESCE(SUM(price),0) AS s FROM evt_registrations WHERE event_id = ? AND status = 'confirmed' AND paid = 1 AND price > 0 AND payment_id IS NULL", [eventId]))?.s ?? 0),
    byTicket: types.map((t) => ({ name: t.name, sold: confirmed.filter((a) => a.ticketName === t.name).length, capacity: t.capacity })),
  };
}

export type CheckInResult = { ok: true; attendee: string; ticketName: string; collect: number } | { ok: false; error: string; attendee?: string; at?: string };

/**
 * EVT-15 Check-in by QR / code. Pay-at-door tickets that are unpaid must be collected (collect > 0) before
 * they are marked; pass `collected=true` once the money is taken.
 */
export async function checkIn(actor: Actor, eventId: string, rawCode: string, collected = false): Promise<CheckInResult> {
  await requireManage(actor, eventId);
  const code = parseTicket(rawCode);
  if (!code) return { ok: false, error: "Mã vé không hợp lệ." };
  const r = await one<{ id: string; member_id: string; event_id: string; status: string; attendee_name: string; checked_in_at: string | null; price: number; paid: number; name: string }>(
    "SELECT r.id, r.member_id, r.event_id, r.status, r.attendee_name, r.checked_in_at, r.price, r.paid, t.name FROM evt_registrations r JOIN evt_ticket_types t ON t.id = r.ticket_type_id WHERE r.ticket_code = ?",
    [code],
  );
  if (!r || r.event_id !== eventId) return { ok: false, error: "Vé không thuộc sự kiện này." };
  if (r.status !== "confirmed") return { ok: false, error: r.status === "pending_payment" ? "Vé chưa thanh toán." : "Vé đã hủy / hoàn tiền.", attendee: r.attendee_name };
  if (r.checked_in_at) return { ok: false, error: "Vé đã được check-in.", attendee: r.attendee_name, at: r.checked_in_at };
  if (Number(r.price) > 0 && !Number(r.paid) && !collected) return { ok: true, attendee: r.attendee_name, ticketName: r.name, collect: Number(r.price) };
  const n = await run("UPDATE evt_registrations SET checked_in_at = ?, checked_in_by = ?, paid = 1, updated_at = ? WHERE id = ? AND checked_in_at IS NULL AND status = 'confirmed'", [now(), actor.id, now(), r.id]);
  if (n !== 1) return { ok: false, error: "Vé vừa được check-in ở máy khác.", attendee: r.attendee_name };
  await awardPoints(r.member_id, "event_checkin", eventId);
  return { ok: true, attendee: r.attendee_name, ticketName: r.name, collect: 0 };
}

export async function approvalQueue(actor: Actor): Promise<EventCard[]> {
  if (!canApprove(actor)) throw new ActionError("Bạn không có quyền duyệt sự kiện.");
  return (await all<CardRow>(`${CARD_SQL} WHERE e.status = 'submitted' ORDER BY e.starts_at`, [actor.id])).map(toCard);
}

/** Daily job: remind confirmed attendees about tomorrow's events; mark finished events completed. */
export async function runEventJobs(): Promise<{ reminded: number; completed: number }> {
  const nowL = nowLocal();
  const in36h = vnLocal(new Date(Date.now() + 36 * 3600_000));
  const soon = await all<{ id: string; title: string; starts_at: string; location: string; mode: EventMode }>(
    "SELECT id, title, starts_at, location, mode FROM evt_events WHERE status = 'published' AND starts_at > ? AND starts_at <= ? AND NOT EXISTS (SELECT 1 FROM evt_reminders x WHERE x.event_id = evt_events.id AND x.kind = 'day_before')",
    [nowL, in36h],
  );
  let reminded = 0;
  for (const e of soon) {
    const people = await all<{ id: string; member_id: string }>("SELECT id, member_id FROM evt_registrations WHERE event_id = ? AND status = 'confirmed'", [e.id]);
    for (const p of people) {
      await notify(p.member_id, { category: "events", title: `Nhắc lịch: ${e.title.slice(0, 60)}`, body: `${e.starts_at.replace("T", " ")} · ${e.mode === "online" ? "Trực tuyến" : e.location}`, href: `/events/tickets/${p.id}`, dedupeKey: `evt-remind:${e.id}` });
      reminded += 1;
    }
    await run("INSERT INTO evt_reminders (event_id, kind, sent_at) VALUES (?, 'day_before', ?) ON CONFLICT DO NOTHING", [e.id, now()]);
  }
  const completed = await run("UPDATE evt_events SET status = 'completed', updated_at = ? WHERE status = 'published' AND ends_at < ?", [now(), nowL]);
  await run("UPDATE evt_registrations SET status = 'cancelled', cancel_reason = 'Hết thời gian giữ chỗ', updated_at = ? WHERE status = 'pending_payment' AND hold_until < ?", [now(), new Date(Date.now() - 10 * 60_000).toISOString()]);
  return { reminded, completed };
}

/**
 * Shared Event Engine (EVT-*; SRS Q11: events can be created by PFC, clubs/groups or members, free or paid).
 * Pure rules, unit tested. Times are Vietnam local "YYYY-MM-DDTHH:mm" strings (compare lexically).
 *
 * draft ─submit─▶ submitted ─approve─▶ published ─(ends)─▶ completed
 *   ▲               │ reject(reason)        └─cancel(reason)─▶ cancelled (refunds every paid ticket)
 *   └── rejected ◀──┘
 * An organizer holding `event.approve` publishes directly.
 */
export const EVENT_STATUSES = ["draft", "submitted", "published", "rejected", "cancelled", "completed"] as const;
export type EventStatus = (typeof EVENT_STATUSES)[number];
export type EventAction = "submit" | "approve" | "reject" | "cancel";

export const EVENT_STATUS_LABEL: Record<EventStatus, string> = {
  draft: "Nháp",
  submitted: "Chờ duyệt",
  published: "Đang mở",
  rejected: "Bị từ chối",
  cancelled: "Đã hủy",
  completed: "Đã kết thúc",
};
export const EVENT_STATUS_TONE: Record<EventStatus, "muted" | "warning" | "income" | "expense" | "primary"> = {
  draft: "muted",
  submitted: "warning",
  published: "income",
  rejected: "expense",
  cancelled: "expense",
  completed: "primary",
};

export const CATEGORIES = { workshop: "Workshop", talk: "Hội thảo / Talk", networking: "Kết nối", competition: "Cuộc thi", social: "Giao lưu", other: "Khác" } as const;
export type EventCategory = keyof typeof CATEGORIES;
export const MODES = { offline: "Trực tiếp", online: "Trực tuyến", hybrid: "Kết hợp" } as const;
export type EventMode = keyof typeof MODES;

export type Who = { isOrganizer: boolean; canApprove: boolean };

export function applyEventAction(a: EventAction, from: EventStatus, who: Who, reason?: string): { ok: true; to: EventStatus } | { ok: false; error: string } {
  const deny = (error: string) => ({ ok: false as const, error });
  switch (a) {
    case "submit":
      if (!who.isOrganizer) return deny("Chỉ người tổ chức gửi duyệt.");
      if (from !== "draft" && from !== "rejected") return deny("Chỉ gửi duyệt bản nháp hoặc sự kiện bị từ chối.");
      return { ok: true, to: who.canApprove ? "published" : "submitted" };
    case "approve":
      if (!who.canApprove) return deny("Bạn không có quyền duyệt sự kiện.");
      return from === "submitted" ? { ok: true, to: "published" } : deny("Chỉ duyệt được sự kiện đang chờ duyệt.");
    case "reject":
      if (!who.canApprove) return deny("Bạn không có quyền duyệt sự kiện.");
      if (from !== "submitted") return deny("Chỉ từ chối được sự kiện đang chờ duyệt.");
      return reason?.trim() ? { ok: true, to: "rejected" } : deny("Cần ghi lý do để người tổ chức sửa.");
    case "cancel":
      if (!who.isOrganizer && !who.canApprove) return deny("Bạn không có quyền hủy sự kiện.");
      if (from !== "published" && from !== "submitted") return deny("Không thể hủy ở trạng thái này.");
      return reason?.trim() ? { ok: true, to: "cancelled" } : deny("Cần ghi lý do hủy (người tham dự sẽ thấy).");
  }
}

export function availableEventActions(status: EventStatus, who: Who): EventAction[] {
  return (["submit", "approve", "reject", "cancel"] as EventAction[]).filter((a) => applyEventAction(a, status, who, "x").ok);
}

/** Vietnam local "YYYY-MM-DDTHH:mm" for an instant. */
export function vnLocal(d: Date): string {
  return new Date(d.getTime() + 7 * 3600_000).toISOString().slice(0, 16);
}
const LOCAL_RE = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/;
export const isLocal = (s: unknown): s is string => typeof s === "string" && LOCAL_RE.test(s);

export type TicketInput = { name: string; description?: string; price: number; capacity: number | null };

export function validateSchedule(startsAt: string, endsAt: string, deadline: string | null, nowLocal: string): string | null {
  if (!isLocal(startsAt) || !isLocal(endsAt)) return "Thời gian không hợp lệ.";
  if (endsAt <= startsAt) return "Thời gian kết thúc phải sau thời gian bắt đầu.";
  if (startsAt <= nowLocal) return "Thời gian bắt đầu phải ở tương lai.";
  if (deadline && (!isLocal(deadline) || deadline > startsAt)) return "Hạn đăng ký phải trước khi sự kiện bắt đầu.";
  return null;
}

export function validateTickets(t: TicketInput[]): string | null {
  if (t.length === 0) return "Cần ít nhất một loại vé (vé miễn phí cũng được).";
  if (t.length > 6) return "Tối đa 6 loại vé.";
  for (const x of t) {
    if (!x.name.trim()) return "Loại vé cần có tên.";
    if (!Number.isInteger(x.price) || x.price < 0 || x.price > 100_000_000) return "Giá vé không hợp lệ.";
    if (x.price > 0 && x.price < 5_000) return "Vé có phí tối thiểu 5.000₫ (giới hạn của cổng thanh toán).";
    if (x.capacity !== null && (!Number.isInteger(x.capacity) || x.capacity < 1)) return "Số lượng vé phải từ 1 trở lên.";
  }
  if (new Set(t.map((x) => x.name.trim().toLowerCase())).size !== t.length) return "Tên loại vé không được trùng.";
  return null;
}

/** Registration is open for published events, before the deadline / start, and while seats remain. */
export function registrationOpen(e: { status: EventStatus; startsAt: string; deadline: string | null }, nowLocal: string): string | null {
  if (e.status !== "published") return "Sự kiện chưa mở đăng ký.";
  if (nowLocal >= (e.deadline ?? e.startsAt)) return "Đã hết hạn đăng ký.";
  return null;
}

/** QR payload on a ticket; the code alone is the secret (random, single event). */
export const TICKET_PREFIX = "PFC-EVT:";
export const ticketPayload = (code: string) => `${TICKET_PREFIX}${code}`;
export function parseTicket(raw: string): string | null {
  const s = raw.trim();
  const code = s.startsWith(TICKET_PREFIX) ? s.slice(TICKET_PREFIX.length) : s;
  return /^[A-Z0-9]{12}$/.test(code.toUpperCase()) ? code.toUpperCase() : null;
}

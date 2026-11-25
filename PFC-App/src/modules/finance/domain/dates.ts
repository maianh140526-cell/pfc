/**
 * Finance dates are Vietnam local time (UTC+7, no DST), stored as "YYYY-MM-DDTHH:mm".
 * Plain strings sort and range-compare correctly, and month buckets match what the user
 * sees regardless of the server's timezone.
 */
export const VN_OFFSET_MIN = 7 * 60;

const pad = (n: number) => String(n).padStart(2, "0");

/** "YYYY-MM-DD" → UTC epoch ms (Date.UTC months are 0-based). */
function dayMs(day: string): number {
  const [y, m, d] = day.split("-").map(Number);
  return Date.UTC(y, m - 1, d);
}

/** Current Vietnam local time as "YYYY-MM-DDTHH:mm". */
export function nowLocal(now: Date = new Date()): string {
  const d = new Date(now.getTime() + VN_OFFSET_MIN * 60_000);
  return `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}T${pad(d.getUTCHours())}:${pad(d.getUTCMinutes())}`;
}

export function todayLocal(now: Date = new Date()): string {
  return nowLocal(now).slice(0, 10);
}

export function monthKeyOf(local: string): string {
  return local.slice(0, 7);
}

export function isMonthKey(s: unknown): s is string {
  return typeof s === "string" && /^\d{4}-(0[1-9]|1[0-2])$/.test(s);
}

export function shiftMonth(month: string, delta: number): string {
  const [y, m] = month.split("-").map(Number);
  const idx = y * 12 + (m - 1) + delta;
  return `${Math.floor(idx / 12)}-${pad((idx % 12) + 1)}`;
}

/** Half-open range [start, end) usable directly in SQL string comparisons. */
export function monthRange(month: string): { start: string; end: string } {
  return { start: `${month}-01T00:00`, end: `${shiftMonth(month, 1)}-01T00:00` };
}

export type PeriodKind = "month" | "quarter" | "year";

export function periodRange(kind: PeriodKind, month: string): { start: string; end: string; months: string[] } {
  const [y, m] = month.split("-").map(Number);
  if (kind === "month") return { ...monthRange(month), months: [month] };
  if (kind === "year") {
    const months = Array.from({ length: 12 }, (_, i) => `${y}-${pad(i + 1)}`);
    return { start: `${y}-01-01T00:00`, end: `${y + 1}-01-01T00:00`, months };
  }
  const qStart = Math.floor((m - 1) / 3) * 3 + 1;
  const first = `${y}-${pad(qStart)}`;
  const months = [first, shiftMonth(first, 1), shiftMonth(first, 2)];
  return { start: `${first}-01T00:00`, end: `${shiftMonth(first, 3)}-01T00:00`, months };
}

export function monthLabel(month: string): string {
  const [y, m] = month.split("-").map(Number);
  return `Tháng ${m}, ${y}`;
}

export function shortMonthLabel(month: string): string {
  return `Th${Number(month.slice(5, 7))}`;
}

export function periodLabel(kind: PeriodKind, month: string): string {
  const [y, m] = month.split("-").map(Number);
  if (kind === "year") return `Năm ${y}`;
  if (kind === "quarter") return `Quý ${Math.floor((m - 1) / 3) + 1}, ${y}`;
  return monthLabel(month);
}

/** "Hôm nay, 15/09/2026" / "Hôm qua, 14/09/2026" / "Thứ Hai, 13/09/2026" headings for grouped lists. */
export function dayHeading(day: string, today: string): string {
  const [y, m, d] = day.split("-").map(Number);
  const dmy = `${pad(d)}/${pad(m)}/${y}`;
  if (day === today) return `Hôm nay, ${dmy}`;
  const t = new Date(dayMs(today) - 86_400_000);
  const yesterday = `${t.getUTCFullYear()}-${pad(t.getUTCMonth() + 1)}-${pad(t.getUTCDate())}`;
  if (day === yesterday) return `Hôm qua, ${dmy}`;
  const wd = new Date(Date.UTC(y, m - 1, d)).getUTCDay();
  const names = ["Chủ nhật", "Thứ Hai", "Thứ Ba", "Thứ Tư", "Thứ Năm", "Thứ Sáu", "Thứ Bảy"];
  return `${names[wd]}, ${dmy}`;
}

export function formatDateVN(local: string): string {
  const [y, m, d] = local.slice(0, 10).split("-");
  return `${d}/${m}/${y}`;
}

export function formatDateTimeVN(local: string): string {
  return `${formatDateVN(local)}, ${local.slice(11, 16)}`;
}

/** Whole days from `from` to `to` (both "YYYY-MM-DD"). */
export function daysBetween(from: string, to: string): number {
  return Math.round((dayMs(to) - dayMs(from)) / 86_400_000);
}

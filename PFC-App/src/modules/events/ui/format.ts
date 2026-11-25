import { formatVnd } from "@/lib/money";

const WD = ["CN", "T2", "T3", "T4", "T5", "T6", "T7"];

/** "T7, 05/12/2026 · 09:00–11:00" from Vietnam-local "YYYY-MM-DDTHH:mm" strings. */
export function eventWhen(startsAt: string, endsAt?: string): string {
  const [d, t] = startsAt.split("T");
  const [y, m, day] = d.split("-").map(Number);
  const wd = WD[new Date(Date.UTC(y, m - 1, day)).getUTCDay()];
  const date = `${wd}, ${String(day).padStart(2, "0")}/${String(m).padStart(2, "0")}/${y}`;
  if (!endsAt) return `${date} · ${t}`;
  const [d2, t2] = endsAt.split("T");
  return d2 === d ? `${date} · ${t}–${t2}` : `${date} ${t} → ${d2.split("-").reverse().join("/")} ${t2}`;
}

export function dayBadge(startsAt: string): { day: string; month: string } {
  const [, m, d] = startsAt.slice(0, 10).split("-");
  return { day: d, month: `Th${Number(m)}` };
}

export function priceRange(min: number, max: number): string {
  if (max === 0) return "Miễn phí";
  if (min === max) return formatVnd(min);
  return min === 0 ? `Miễn phí – ${formatVnd(max)}` : `${formatVnd(min)} – ${formatVnd(max)}`;
}

export const REG_STATUS_LABEL: Record<string, string> = {
  pending_payment: "Chờ thanh toán",
  confirmed: "Đã xác nhận",
  cancelled: "Đã hủy",
  refunded: "Đã hoàn tiền",
};
export const REG_STATUS_TONE: Record<string, "income" | "warning" | "muted" | "expense"> = {
  pending_payment: "warning",
  confirmed: "income",
  cancelled: "muted",
  refunded: "expense",
};

import Link from "next/link";
import { SUPPORT_CATEGORIES, type TicketRow } from "@/platform/admin/console";
import { Badge } from "@/ui";

export const TICKET_STATUS = { open: { label: "Đang chờ", tone: "warning" }, answered: { label: "Đã trả lời", tone: "income" }, closed: { label: "Đã đóng", tone: "muted" } } as const;

export function TicketList({ items, base, showMember }: { items: TicketRow[]; base: string; showMember?: boolean }) {
  return (
    <ul className="space-y-2">
      {items.map((t) => (
        <li key={t.id}>
          <Link href={`${base}/${t.id}`} className="pressable block rounded-[var(--radius-card)] border border-line bg-surface p-3">
            <span className="flex items-center justify-between gap-2">
              <span className="truncate text-[14px] font-bold text-ink">{t.subject}</span>
              <Badge tone={TICKET_STATUS[t.status].tone}>{TICKET_STATUS[t.status].label}</Badge>
            </span>
            <span className="block text-[12px] text-muted">
              {SUPPORT_CATEGORIES[t.category]}
              {showMember && ` · ${t.memberName}`} · {new Date(t.updatedAt).toLocaleString("vi-VN", { timeZone: "Asia/Ho_Chi_Minh" })}
            </span>
          </Link>
        </li>
      ))}
    </ul>
  );
}

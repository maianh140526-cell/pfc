import Link from "next/link";
import { Bell } from "lucide-react";

/** Header bell with unread badge (mockup 8). Server-rendered count; no polling. */
export function NotificationBell({ count }: { count: number }) {
  const label = count > 0 ? `Thông báo, ${count} chưa đọc` : "Thông báo";
  return (
    <Link href="/notifications" aria-label={label} className="relative grid size-11 place-items-center rounded-full text-ink active:bg-surface-2">
      <Bell size={22} />
      {count > 0 && (
        <span className="absolute top-1.5 right-1.5 grid h-[18px] min-w-[18px] place-items-center rounded-full bg-expense px-1 text-[11px] leading-none font-bold text-surface">
          {count > 99 ? "99+" : count}
        </span>
      )}
    </Link>
  );
}

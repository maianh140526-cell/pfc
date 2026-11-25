import Link from "next/link";
import { MessageCircle } from "lucide-react";
import { timeAgo } from "@/lib/time";
import { requireMember, toActor } from "@/platform/auth/session";
import { listConversations } from "@/modules/community/server/messages";
import { AppHeader, EmptyState, ButtonLink } from "@/ui";
import { Avatar } from "@/ui/Avatar";
import { cx } from "@/ui/cx";

export const metadata = { title: "Tin nhắn" };
export const dynamic = "force-dynamic";

/** Messages / Chat List (mockup 79). */
export default async function MessagesPage() {
  const me = await requireMember("/messages");
  const list = await listConversations(toActor(me));
  return (
    <>
      <AppHeader back backFallback="/community" title="Tin nhắn" />
      {list.length === 0 ? (
        <EmptyState
          icon={MessageCircle}
          title="Chưa có tin nhắn"
          description="Mở hồ sơ một thành viên và chọn “Nhắn tin”."
          action={
            <ButtonLink href="/community/members" block>
              Tìm thành viên
            </ButtonLink>
          }
        />
      ) : (
        <ul className="divide-y divide-line px-4">
          {list.map((c) => (
            <li key={c.id}>
              <Link href={`/messages/${c.id}`} className="flex items-center gap-3 py-3 active:bg-surface-2">
                <Avatar name={c.otherName} url={c.otherAvatar} size={48} />
                <span className="min-w-0 flex-1">
                  <span className="flex items-baseline justify-between gap-2">
                    <span className={cx("truncate text-[15px] text-ink", c.unread ? "font-bold" : "font-semibold")}>{c.otherName}</span>
                    <span className="shrink-0 text-[12px] text-muted">{timeAgo(c.lastAt)}</span>
                  </span>
                  <span className="flex items-center gap-2">
                    <span className={cx("min-w-0 flex-1 truncate text-[13px]", c.unread ? "font-semibold text-ink" : "text-muted")}>
                      {c.lastMine ? "Bạn: " : ""}
                      {c.lastBody}
                    </span>
                    {c.unread > 0 && <span className="grid h-5 min-w-5 place-items-center rounded-full bg-primary px-1.5 text-[11px] font-bold text-on-primary">{c.unread}</span>}
                  </span>
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </>
  );
}

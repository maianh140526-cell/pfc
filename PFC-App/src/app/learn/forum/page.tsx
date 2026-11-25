import Link from "next/link";
import { EyeOff, Heart, Lock, MessageSquare, MessagesSquare, Plus } from "lucide-react";
import { currentMember, toActor } from "@/platform/auth/session";
import { FORUM_TOPICS, listThreads } from "@/modules/education/server/service";
import { AppHeader, EmptyState, HeaderIconButton } from "@/ui";
import { FilterChips } from "@/ui/FilterChips";
import { SearchBox } from "@/ui/SearchBox";

export const metadata = { title: "Diễn đàn" };
export const dynamic = "force-dynamic";

const ago = (iso: string) => {
  const m = Math.round((Date.now() - new Date(iso).getTime()) / 60000);
  if (m < 60) return `${Math.max(1, m)} phút trước`;
  if (m < 1440) return `${Math.round(m / 60)} giờ trước`;
  return `${Math.round(m / 1440)} ngày trước`;
};

/** EDU-16 Forum / EDU-17 Topic (mockup 48 / 140). */
export default async function ForumPage({ searchParams }: { searchParams: Promise<{ topic?: string; q?: string }> }) {
  const { topic, q } = await searchParams;
  const me = await currentMember();
  const threads = await listThreads(me ? toActor(me) : null, { topic, q: q?.slice(0, 80) });
  return (
    <>
      <AppHeader
        title="Diễn đàn"
        backHref="/learn"
        actions={
          <HeaderIconButton label="Tạo chủ đề" href={me ? "/learn/forum/new" : "/login?next=/learn/forum/new"}>
            <Plus size={24} />
          </HeaderIconButton>
        }
      />
      <div className="space-y-3 px-4">
        <SearchBox placeholder="Tìm chủ đề thảo luận…" />
        <FilterChips
          label="Chủ đề"
          value={topic && topic in FORUM_TOPICS ? topic : "all"}
          hrefFor={(t) => (t === "all" ? "/learn/forum" : `/learn/forum?topic=${t}`)}
          options={[{ value: "all", label: "Tất cả" }, ...Object.entries(FORUM_TOPICS).map(([value, label]) => ({ value, label }))]}
        />
      </div>
      {threads.length === 0 ? (
        <EmptyState icon={MessagesSquare} title="Chưa có thảo luận" description="Hãy là người đặt câu hỏi đầu tiên!" />
      ) : (
        <ul className="space-y-3 px-4 pt-3">
          {threads.map((t) => (
            <li key={t.id}>
              <Link href={`/learn/forum/${t.id}`} className="pressable block rounded-[var(--radius-card)] border border-line bg-surface p-4 shadow-card">
                <p className="text-[12px] text-muted">
                  {t.author_name} · {ago(t.last_activity_at)} · {FORUM_TOPICS[t.topic] ?? t.topic}
                </p>
                <p className="mt-1 flex items-center gap-1.5 text-[16px] font-bold text-ink">
                  {t.hidden && <EyeOff size={15} className="text-expense" aria-label="Đã ẩn" />}
                  {t.locked && <Lock size={15} className="text-muted" aria-label="Đã khóa" />}
                  {t.title}
                </p>
                <p className="mt-1 line-clamp-2 text-[14px] text-ink-2">{t.body}</p>
                <p className="mt-2 flex gap-4 text-[13px] text-muted">
                  <span className="flex items-center gap-1">
                    <Heart size={14} /> {t.likes}
                  </span>
                  <span className="flex items-center gap-1">
                    <MessageSquare size={14} /> {t.replies}
                  </span>
                </p>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </>
  );
}

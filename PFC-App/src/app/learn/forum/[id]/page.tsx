import { notFound } from "next/navigation";
import { currentMember, toActor } from "@/platform/auth/session";
import { FORUM_TOPICS, getThread } from "@/modules/education/server/service";
import { AppHeader, Badge, Section } from "@/ui";
import { ThreadActions, ReplyBox, ReplyItem } from "./ThreadClient";

export const dynamic = "force-dynamic";

/** EDU-19 Discussion Detail (mockup 141). */
export default async function ThreadPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const me = await currentMember();
  const t = await getThread(me ? toActor(me) : null, id);
  if (!t) notFound();
  return (
    <>
      <AppHeader back backFallback="/learn/forum" title="Chi tiết thảo luận" />
      <div className="px-4">
        <div className="flex flex-wrap gap-2">
          <Badge>{FORUM_TOPICS[t.topic] ?? t.topic}</Badge>
          {t.hidden && <Badge tone="expense">Đã bị ẩn</Badge>}
          {t.locked && <Badge tone="muted">Đã khóa bình luận</Badge>}
        </div>
        <h1 className="mt-2 text-[20px] leading-tight font-extrabold text-ink">{t.title}</h1>
        <p className="mt-1 text-[13px] text-muted">
          {t.authorName} · {new Date(t.createdAt).toLocaleString("vi-VN")}
        </p>
        <p className="mt-3 text-[15px] leading-relaxed whitespace-pre-line text-ink-2">{t.body}</p>
        <ThreadActions id={t.id} likes={t.likes} liked={t.liked} signedIn={!!me} isAuthor={t.isAuthor} canModerate={t.canModerate} hidden={t.hidden} locked={t.locked} />
      </div>
      <Section title={`Bình luận (${t.replies.length})`}>
        <ul className="space-y-3">
          {t.replies
            .filter((r) => !r.parentId)
            .map((r) => (
              <ReplyItem
                key={r.id}
                r={r}
                canModerate={t.canModerate}
                threadId={t.id}
                canReply={!!me && !t.locked}
                replies={t.replies.filter((c) => c.parentId === r.id)}
              />
            ))}
        </ul>
        {me ? (
          t.locked ? (
            <p className="mt-3 text-center text-[13px] text-muted">Chủ đề đã khóa bình luận.</p>
          ) : (
            <ReplyBox threadId={t.id} />
          )
        ) : (
          <p className="mt-3 text-center text-[13px] text-muted">Đăng nhập để bình luận.</p>
        )}
      </Section>
    </>
  );
}

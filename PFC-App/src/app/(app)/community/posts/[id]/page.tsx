import Link from "next/link";
import { notFound } from "next/navigation";
import { EyeOff, Users } from "lucide-react";
import { timeAgo } from "@/lib/time";
import { currentMember, toActor } from "@/platform/auth/session";
import { TOPICS } from "@/modules/community/domain/rules";
import { getPost, socialStats } from "@/modules/community/server/service";
import { LikeButton, SaveButton } from "@/modules/community/ui/PostActions";
import { AppHeader, Section } from "@/ui";
import { Avatar } from "@/ui/Avatar";
import { Comments, FollowButton, PollBox, PostMenu, ShareButton } from "./PostClient";

export const dynamic = "force-dynamic";

/** COM-03 Post Detail (mockup 75). */
export default async function PostPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const me = await currentMember();
  const actor = me ? toActor(me) : null;
  const p = await getPost(actor, id);
  if (!p) notFound();
  const follow = me && me.id !== p.authorId ? await socialStats(actor, p.authorId) : null;
  return (
    <>
      <AppHeader back backFallback="/community/posts" title="Bài viết" actions={me ? <PostMenu post={{ id: p.id, authorId: p.authorId, canEdit: p.canEdit, canModerate: p.canModerate, status: p.status }} myId={me.id} /> : undefined} />
      <article className="px-4">
        {p.status === "hidden" && (
          <p className="mb-3 flex gap-2 rounded-2xl bg-expense-soft p-3 text-[13px] text-expense">
            <EyeOff size={16} className="mt-0.5 shrink-0" /> Bài đã bị ẩn bởi kiểm duyệt: {p.hiddenReason}
          </p>
        )}
        <header className="flex items-center gap-3">
          <Link href={`/members/${p.authorId}`}>
            <Avatar name={p.authorName} url={p.authorAvatar} size={44} />
          </Link>
          <div className="min-w-0 flex-1">
            <Link href={`/members/${p.authorId}`} className="block truncate text-[15px] font-semibold text-ink">
              {p.authorName}
            </Link>
            <p className="text-[12px] text-muted">
              {timeAgo(p.createdAt)} · {TOPICS[p.topic]}
              {p.groupId && (
                <>
                  {" · "}
                  <Link href={`/community/groups/${p.groupId}`} className="font-semibold text-primary">
                    <Users size={11} className="inline" /> {p.groupName}
                  </Link>
                </>
              )}
            </p>
          </div>
          {follow && !follow.blocked && <FollowButton memberId={p.authorId} following={follow.isFollowing} />}
        </header>
        {p.title && <h1 className="mt-3 text-[20px] leading-snug font-extrabold text-ink">{p.title}</h1>}
        <p className="mt-2 text-[15px] leading-relaxed whitespace-pre-line text-ink-2">{p.body}</p>
        {p.tags.length > 0 && (
          <ul className="mt-3 flex flex-wrap gap-1.5">
            {p.tags.map((t) => (
              <li key={t}>
                <Link href={`/community/posts?tag=${encodeURIComponent(t)}`} className="rounded-full bg-primary-soft px-2.5 py-1 text-[12px] font-semibold text-primary">
                  #{t}
                </Link>
              </li>
            ))}
          </ul>
        )}
        {p.images.length > 0 && (
          <div className="mt-3 space-y-2">
            {p.images.map((u, i) => (
              // eslint-disable-next-line @next/next/no-img-element -- server-processed upload
              <img key={u} src={u} alt={`Ảnh ${i + 1}`} loading="lazy" className="w-full rounded-2xl object-cover" />
            ))}
          </div>
        )}
        {p.poll && <PollBox postId={p.id} poll={p.poll} canVote={!!me && p.status === "published"} />}
        <div className="mt-3 flex items-center gap-4 border-y border-line py-1 text-[13px] text-muted">
          <LikeButton postId={p.id} liked={p.liked} count={p.likes} disabled={!me || p.status !== "published"} />
          {me && p.status === "published" && <SaveButton postId={p.id} saved={p.saved} />}
          <ShareButton title={p.title || p.body.slice(0, 60)} />
        </div>
      </article>
      <Section title={`Bình luận (${p.commentList.filter((c) => !c.hidden).length})`}>
        <div id="binh-luan">
          <Comments postId={p.id} comments={p.commentList} canComment={!!me && p.allowComments && p.status === "published"} allowComments={p.allowComments} canModerate={p.canModerate} signedIn={!!me} />
        </div>
      </Section>
    </>
  );
}

import Link from "next/link";
import { EyeOff, MessageCircle, Users } from "lucide-react";
import { timeAgo } from "@/lib/time";
import { Avatar } from "@/ui/Avatar";
import { TOPICS } from "../domain/rules";
import type { PostCard as Post } from "../server/service";
import { LikeButton } from "./PostActions";

/** Feed item (mockups 73–74). Body is plain text (React escapes it); hashtags link to the tag feed. */
export function PostCard({ p, signedIn }: { p: Post; signedIn: boolean }) {
  return (
    <article className="rounded-[var(--radius-card)] border border-line bg-surface p-4 shadow-card">
      <header className="flex items-center gap-2.5">
        <Link href={`/members/${p.authorId}`} aria-label={p.authorName}>
          <Avatar name={p.authorName} url={p.authorAvatar} size={40} />
        </Link>
        <div className="min-w-0 flex-1">
          <Link href={`/members/${p.authorId}`} className="block truncate text-[14px] font-semibold text-ink">
            {p.authorName}
          </Link>
          <p className="truncate text-[12px] text-muted">
            {timeAgo(p.createdAt)} · {TOPICS[p.topic]}
            {p.groupName && (
              <>
                {" · "}
                <Users size={11} className="inline" /> {p.groupName}
              </>
            )}
          </p>
        </div>
        {p.status !== "published" && (
          <span className="flex items-center gap-1 rounded-full bg-surface-2 px-2 py-0.5 text-[11px] font-semibold text-muted">
            {p.status === "draft" ? "Nháp" : (<><EyeOff size={11} /> Đã ẩn</>)}
          </span>
        )}
      </header>
      <Link href={`/community/posts/${p.id}`} className="mt-2 block">
        {p.title && <h3 className="text-[16px] leading-snug font-bold text-ink">{p.title}</h3>}
        <p className="mt-1 line-clamp-3 text-[14px] whitespace-pre-line text-ink-2">{p.body}</p>
        {p.images[0] && (
          // eslint-disable-next-line @next/next/no-img-element -- server-processed upload
          <img src={p.images[0]} alt="" loading="lazy" className="mt-3 max-h-64 w-full rounded-2xl object-cover" />
        )}
      </Link>
      {p.tags.length > 0 && (
        <ul className="mt-2 flex flex-wrap gap-1.5">
          {p.tags.slice(0, 4).map((t) => (
            <li key={t}>
              <Link href={`/community/posts?tag=${encodeURIComponent(t)}`} className="rounded-full bg-primary-soft px-2 py-0.5 text-[12px] font-semibold text-primary">
                #{t}
              </Link>
            </li>
          ))}
        </ul>
      )}
      <footer className="mt-3 flex items-center gap-4 text-[13px] text-muted">
        <LikeButton postId={p.id} liked={p.liked} count={p.likes} disabled={!signedIn || p.status !== "published"} />
        <Link href={`/community/posts/${p.id}#binh-luan`} className="flex min-h-11 items-center gap-1.5">
          <MessageCircle size={18} /> {p.comments}
        </Link>
      </footer>
    </article>
  );
}

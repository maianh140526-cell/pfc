"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { Check, CornerDownRight, Flag, MoreHorizontal, Pencil, Send, Share2, Trash2, UserCheck, UserPlus } from "lucide-react";
import { useState } from "react";
import { timeAgo } from "@/lib/time";
import { REPORT_REASONS, type PostStatus, type ReportReason } from "@/modules/community/domain/rules";
import {
  addCommentAction,
  deleteCommentAction,
  deletePostAction,
  reportAction,
  setCommentHiddenAction,
  setPostHiddenAction,
  toggleFollowAction,
  voteAction,
} from "@/modules/community/server/actions";
import { BottomSheet, Button } from "@/ui";
import { Avatar } from "@/ui/Avatar";
import { ConfirmSheet } from "@/ui/ConfirmSheet";
import { FormError, SelectInput, TextArea } from "@/ui/Form";
import { cx } from "@/ui/cx";
import { useAction } from "@/ui/use-action";

export function FollowButton({ memberId, following }: { memberId: string; following: boolean }) {
  const a = useAction();
  return (
    <button
      type="button"
      disabled={a.pending}
      onClick={() => a.run(() => toggleFollowAction(memberId))}
      className={cx("flex min-h-9 items-center gap-1 rounded-full px-3 text-[13px] font-semibold", following ? "bg-surface-2 text-ink-2" : "border border-primary text-primary")}
    >
      {following ? <UserCheck size={15} /> : <UserPlus size={15} />} {following ? "Đang theo dõi" : "Theo dõi"}
    </button>
  );
}

export function ShareButton({ title }: { title: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      type="button"
      className="ml-auto flex min-h-11 items-center gap-1.5"
      onClick={async () => {
        const url = location.href.split("#")[0];
        if (navigator.share) await navigator.share({ title, url }).catch(() => undefined);
        else {
          await navigator.clipboard?.writeText(url).catch(() => undefined);
          setCopied(true);
        }
      }}
    >
      <Share2 size={18} /> {copied ? "Đã sao chép" : "Chia sẻ"}
    </button>
  );
}

export function PollBox({ postId, poll, canVote }: { postId: string; poll: { options: { id: string; label: string; votes: number }[]; total: number; myVote: string | null }; canVote: boolean }) {
  const a = useAction();
  return (
    <fieldset className="mt-3 space-y-2 rounded-[var(--radius-card)] border border-line bg-surface p-3">
      <legend className="px-1 text-[13px] font-semibold text-muted">Bình chọn · {poll.total} lượt</legend>
      {poll.options.map((o) => {
        const pct = poll.total ? Math.round((o.votes / poll.total) * 100) : 0;
        const mine = poll.myVote === o.id;
        return (
          <button
            key={o.id}
            type="button"
            disabled={!canVote || a.pending}
            onClick={() => a.run(() => voteAction(postId, o.id))}
            className={cx("relative flex min-h-11 w-full items-center overflow-hidden rounded-xl border px-3 text-left text-[14px]", mine ? "border-primary" : "border-line")}
          >
            {poll.myVote && <span aria-hidden="true" className="absolute inset-y-0 left-0 bg-primary-soft" style={{ width: `${pct}%` }} />}
            <span className="relative flex-1 font-semibold text-ink">
              {mine && <Check size={14} className="mr-1 inline text-primary" />}
              {o.label}
            </span>
            {poll.myVote && <span className="relative text-[13px] font-bold text-ink-2">{pct}%</span>}
          </button>
        );
      })}
      <FormError message={a.error} />
    </fieldset>
  );
}

type C = { id: string; authorId: string; authorName: string; authorAvatar: string | null; body: string; createdAt: string; hidden: boolean; mine: boolean; parentId: string | null };

export function Comments({ postId, comments, canComment, allowComments, canModerate, signedIn }: { postId: string; comments: C[]; canComment: boolean; allowComments: boolean; canModerate: boolean; signedIn: boolean }) {
  const a = useAction();
  const [text, setText] = useState("");
  const [replyTo, setReplyTo] = useState<C | null>(null);
  const roots = comments.filter((c) => !c.parentId);
  const replies = (id: string) => comments.filter((c) => c.parentId === id);
  const item = (c: C, nested = false) => (
    <li key={c.id} className={cx("flex gap-2.5", nested && "pl-8")}>
      {nested && <CornerDownRight size={14} className="mt-2 shrink-0 text-muted" />}
      <Avatar name={c.authorName} url={c.authorAvatar} size={34} />
      <div className="min-w-0 flex-1">
        <div className={cx("rounded-2xl px-3 py-2", c.hidden ? "bg-expense-soft" : "bg-surface-2")}>
          <Link href={`/members/${c.authorId}`} className="text-[13px] font-semibold text-ink">
            {c.authorName}
          </Link>
          <p className="text-[14px] whitespace-pre-line text-ink-2">{c.body}</p>
          {c.hidden && <p className="text-[11px] font-semibold text-expense">Đã ẩn bởi kiểm duyệt</p>}
        </div>
        <div className="mt-0.5 flex gap-3 px-2 text-[12px] text-muted">
          <span>{timeAgo(c.createdAt)}</span>
          {canComment && !nested && (
            <button type="button" className="font-semibold" onClick={() => setReplyTo(c)}>
              Trả lời
            </button>
          )}
          {c.mine && (
            <button type="button" className="font-semibold" onClick={() => a.run(() => deleteCommentAction(c.id))}>
              Xóa
            </button>
          )}
          {canModerate && !c.mine && (
            <button type="button" className="font-semibold" onClick={() => a.run(() => setCommentHiddenAction(c.id, !c.hidden))}>
              {c.hidden ? "Hiện lại" : "Ẩn"}
            </button>
          )}
          {signedIn && !c.mine && <ReportLink targetType="comment" targetId={c.id} />}
        </div>
      </div>
    </li>
  );
  return (
    <>
      {comments.length === 0 ? (
        <p className="text-[14px] text-muted">{allowComments ? "Chưa có bình luận." : "Tác giả đã tắt bình luận."}</p>
      ) : (
        <ul className="space-y-3">
          {roots.map((c) => (
            <li key={c.id}>
              <ul className="space-y-2">
                {item(c)}
                {replies(c.id).map((r) => item(r, true))}
              </ul>
            </li>
          ))}
        </ul>
      )}
      {canComment && (
        <form
          className="sticky bottom-[calc(var(--tabbar-h)+var(--safe-bottom))] mt-4 -mx-4 border-t border-line bg-bg px-4 py-2"
          onSubmit={(e) => {
            e.preventDefault();
            a.run(() => addCommentAction(postId, text, replyTo?.id ?? null), () => {
              setText("");
              setReplyTo(null);
            });
          }}
        >
          {replyTo && (
            <p className="mb-1 text-[12px] text-muted">
              Trả lời {replyTo.authorName} ·{" "}
              <button type="button" className="font-semibold text-primary" onClick={() => setReplyTo(null)}>
                Hủy
              </button>
            </p>
          )}
          <div className="flex items-end gap-2">
            <label className="sr-only" htmlFor="comment-box">
              Viết bình luận
            </label>
            <textarea
              id="comment-box"
              value={text}
              onChange={(e) => setText(e.target.value)}
              rows={1}
              maxLength={2000}
              placeholder="Viết bình luận…"
              className="max-h-32 min-h-11 flex-1 resize-none rounded-[20px] border border-line bg-surface px-4 py-2.5 text-[15px] text-ink outline-none focus:border-primary"
            />
            <button type="submit" aria-label="Gửi bình luận" disabled={a.pending || !text.trim()} className="grid size-11 shrink-0 place-items-center rounded-full bg-primary text-on-primary disabled:opacity-50">
              <Send size={18} />
            </button>
          </div>
          <FormError message={a.error} />
        </form>
      )}
    </>
  );
}

export function ReportLink({ targetType, targetId, label = "Báo cáo" }: { targetType: "post" | "comment" | "group" | "member" | "message"; targetId: string; label?: string }) {
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState<ReportReason>("spam");
  const [details, setDetails] = useState("");
  const [done, setDone] = useState(false);
  const a = useAction();
  return (
    <>
      <button type="button" className="flex items-center gap-1 font-semibold" onClick={() => setOpen(true)}>
        <Flag size={12} /> {done ? "Đã báo cáo" : label}
      </button>
      <BottomSheet
        open={open}
        onClose={() => setOpen(false)}
        title="Báo cáo vi phạm"
        footer={
          <Button block disabled={a.pending} onClick={() => a.run(() => reportAction({ targetType, targetId, reason, details }), () => (setDone(true), setOpen(false)))}>
            Gửi báo cáo
          </Button>
        }
      >
        <div className="space-y-3">
          <SelectInput label="Lý do" value={reason} onChange={(e) => setReason(e.target.value as ReportReason)}>
            {Object.entries(REPORT_REASONS).map(([k, v]) => (
              <option key={k} value={k}>
                {v}
              </option>
            ))}
          </SelectInput>
          <TextArea label="Chi tiết (không bắt buộc)" value={details} onChange={(e) => setDetails(e.target.value)} maxLength={1000} />
          <p className="text-[12px] text-muted">Ban kiểm duyệt xem xét báo cáo. Người bị báo cáo không biết ai đã báo cáo.</p>
          <FormError message={a.error} />
        </div>
      </BottomSheet>
    </>
  );
}

export function PostMenu({ post, myId }: { post: { id: string; authorId: string; canEdit: boolean; canModerate: boolean; status: PostStatus }; myId: string }) {
  const router = useRouter();
  const a = useAction();
  const [open, setOpen] = useState(false);
  const [del, setDel] = useState(false);
  const [hide, setHide] = useState(false);
  const [reason, setReason] = useState("");
  const mine = post.authorId === myId;
  return (
    <>
      <button type="button" aria-label="Tùy chọn bài viết" onClick={() => setOpen(true)} className="grid size-11 place-items-center rounded-full text-ink active:bg-surface-2">
        <MoreHorizontal size={22} />
      </button>
      <BottomSheet open={open} onClose={() => setOpen(false)} title="Tùy chọn">
        <ul className="divide-y divide-line text-[15px]">
          {post.canEdit && (
            <li>
              <Link href={`/community/posts/${post.id}/edit`} className="flex min-h-12 items-center gap-3 text-ink">
                <Pencil size={18} /> Sửa bài
              </Link>
            </li>
          )}
          {mine && (
            <li>
              <button type="button" className="flex min-h-12 w-full items-center gap-3 text-expense" onClick={() => (setOpen(false), setDel(true))}>
                <Trash2 size={18} /> Xóa bài
              </button>
            </li>
          )}
          {post.canModerate && !mine && (
            <li>
              <button
                type="button"
                className="flex min-h-12 w-full items-center gap-3 text-expense"
                onClick={() => (post.status === "hidden" ? a.run(() => setPostHiddenAction(post.id, false), () => setOpen(false)) : (setOpen(false), setHide(true)))}
              >
                <Flag size={18} /> {post.status === "hidden" ? "Hiện lại bài" : "Ẩn bài (kiểm duyệt)"}
              </button>
            </li>
          )}
          {!mine && (
            <li className="flex min-h-12 items-center text-ink">
              <ReportLink targetType="post" targetId={post.id} label="Báo cáo bài viết" />
            </li>
          )}
        </ul>
        <FormError message={a.error} />
      </BottomSheet>
      <ConfirmSheet open={del} onClose={() => setDel(false)} title="Xóa bài viết?" message="Bài và bình luận sẽ không còn hiển thị." pending={a.pending} error={a.error} onConfirm={() => a.run(() => deletePostAction(post.id), () => router.replace("/community/posts?tab=mine"))} />
      <BottomSheet
        open={hide}
        onClose={() => setHide(false)}
        title="Ẩn bài viết"
        footer={
          <Button variant="danger" block disabled={a.pending || !reason.trim()} onClick={() => a.run(() => setPostHiddenAction(post.id, true, reason), () => setHide(false))}>
            Ẩn bài
          </Button>
        }
      >
        <TextArea label="Lý do (tác giả sẽ thấy)" value={reason} onChange={(e) => setReason(e.target.value)} maxLength={300} />
      </BottomSheet>
    </>
  );
}

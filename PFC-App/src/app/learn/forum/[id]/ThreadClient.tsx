"use client";

import { useRouter } from "next/navigation";
import { Eye, EyeOff, Heart, Lock, LockOpen, Send, Trash2 } from "lucide-react";
import { useState } from "react";
import { deleteOwnPostAction, moderateReplyAction, moderateThreadAction, replyAction, toggleLikeAction } from "@/modules/education/server/actions";
import { Badge } from "@/ui";
import { ConfirmSheet } from "@/ui/ConfirmSheet";
import { FormError } from "@/ui/Form";
import { useAction } from "@/ui/use-action";
import { cx } from "@/ui/cx";

const chip = "pressable flex items-center gap-1.5 rounded-full border border-line px-3 py-1.5 text-[13px] font-semibold";

export function ThreadActions(p: { id: string; likes: number; liked: boolean; signedIn: boolean; isAuthor: boolean; canModerate: boolean; hidden: boolean; locked: boolean }) {
  const router = useRouter();
  const a = useAction();
  const [confirm, setConfirm] = useState(false);
  return (
    <>
      <div className="mt-4 flex flex-wrap gap-2">
        <button
          type="button"
          disabled={!p.signedIn || a.pending}
          onClick={() => a.run(() => toggleLikeAction(p.id))}
          aria-pressed={p.liked}
          className={cx(chip, p.liked ? "border-expense bg-expense-soft text-expense" : "text-ink-2")}
        >
          <Heart size={15} fill={p.liked ? "currentColor" : "none"} /> {p.likes}
        </button>
        {p.canModerate && (
          <>
            <button type="button" className={cx(chip, "text-ink-2")} disabled={a.pending} onClick={() => a.run(() => moderateThreadAction(p.id, { locked: !p.locked }))}>
              {p.locked ? <LockOpen size={15} /> : <Lock size={15} />} {p.locked ? "Mở khóa" : "Khóa bình luận"}
            </button>
            <button type="button" className={cx(chip, "text-expense")} disabled={a.pending} onClick={() => a.run(() => moderateThreadAction(p.id, { hidden: !p.hidden }))}>
              {p.hidden ? <Eye size={15} /> : <EyeOff size={15} />} {p.hidden ? "Hiện lại" : "Ẩn bài"}
            </button>
          </>
        )}
        {p.isAuthor && (
          <button type="button" className={cx(chip, "text-expense")} onClick={() => setConfirm(true)}>
            <Trash2 size={15} /> Xóa bài
          </button>
        )}
      </div>
      <div className="mt-2">
        <FormError message={a.error} />
      </div>
      <ConfirmSheet
        open={confirm}
        onClose={() => setConfirm(false)}
        title="Xóa bài viết?"
        message="Bài viết và toàn bộ bình luận sẽ bị xóa vĩnh viễn."
        pending={a.pending}
        onConfirm={() => a.run(() => deleteOwnPostAction("thread", p.id), () => router.replace("/learn/forum"))}
      />
    </>
  );
}

type Reply = { id: string; body: string; hidden: boolean; createdAt: string; authorName: string; isAuthor: boolean };

/** A top-level comment with its replies (one level) and a "Trả lời" box. */
export function ReplyItem({ r, canModerate, threadId, canReply, replies = [] }: { r: Reply; canModerate: boolean; threadId?: string; canReply?: boolean; replies?: Reply[] }) {
  const [replying, setReplying] = useState(false);
  return (
    <li>
      <Comment r={r} canModerate={canModerate} onReply={canReply ? () => setReplying((x) => !x) : undefined} />
      {(replies.length > 0 || replying) && (
        <ul className="mt-2 ml-5 space-y-2 border-l-2 border-line pl-3">
          {replies.map((c) => (
            <li key={c.id}>
              <Comment r={c} canModerate={canModerate} onReply={canReply ? () => setReplying(true) : undefined} />
            </li>
          ))}
          {replying && threadId && (
            <li>
              <ReplyBox threadId={threadId} parentId={r.id} placeholder={`Trả lời ${r.authorName}…`} onDone={() => setReplying(false)} />
            </li>
          )}
        </ul>
      )}
    </li>
  );
}

function Comment({ r, canModerate, onReply }: { r: Reply; canModerate: boolean; onReply?: () => void }) {
  const a = useAction();
  return (
    <div className={cx("rounded-2xl border border-line bg-surface p-3", r.hidden && "opacity-60")}>
      <p className="flex items-center gap-2 text-[13px] font-semibold text-ink">
        {r.authorName}
        <span className="font-normal text-muted">· {new Date(r.createdAt).toLocaleString("vi-VN")}</span>
        {r.hidden && <Badge tone="expense">Đã ẩn</Badge>}
      </p>
      <p className="mt-1 text-[14px] whitespace-pre-line text-ink-2">{r.body}</p>
      {(canModerate || r.isAuthor || onReply) && (
        <div className="mt-2 flex gap-3 text-[12px] font-semibold">
          {onReply && !r.hidden && (
            <button type="button" className="text-primary" onClick={onReply}>
              Trả lời
            </button>
          )}
          {canModerate && (
            <button type="button" className="text-expense" disabled={a.pending} onClick={() => a.run(() => moderateReplyAction(r.id, !r.hidden))}>
              {r.hidden ? "Hiện lại" : "Ẩn bình luận"}
            </button>
          )}
          {r.isAuthor && (
            <button type="button" className="text-expense" disabled={a.pending} onClick={() => a.run(() => deleteOwnPostAction("reply", r.id))}>
              Xóa
            </button>
          )}
        </div>
      )}
      {a.error && <p className="mt-1 text-[12px] text-expense">{a.error}</p>}
    </div>
  );
}

export function ReplyBox({ threadId, parentId, placeholder = "Viết bình luận…", onDone }: { threadId: string; parentId?: string; placeholder?: string; onDone?: () => void }) {
  const [body, setBody] = useState("");
  const a = useAction();
  return (
    <>
      <div className={cx("flex items-end gap-2", parentId ? "mt-1" : "mt-3")}>
        <textarea
          value={body}
          onChange={(e) => setBody(e.target.value)}
          rows={2}
          maxLength={5000}
          placeholder={placeholder}
          aria-label={placeholder}
          autoFocus={!!parentId}
          className="min-w-0 flex-1 resize-none rounded-2xl border border-line bg-surface px-4 py-2.5 text-[16px] text-ink outline-none placeholder:text-muted focus:border-primary"
        />
        <button
          type="button"
          aria-label="Gửi bình luận"
          disabled={!body.trim() || a.pending}
          onClick={() =>
            a.run(
              () => replyAction(threadId, body, parentId ?? null),
              () => {
                setBody("");
                onDone?.();
              },
            )
          }
          className="pressable grid size-12 place-items-center rounded-full bg-primary text-on-primary disabled:opacity-40"
        >
          <Send size={20} />
        </button>
      </div>
      <div className="mt-2">
        <FormError message={a.error} />
      </div>
    </>
  );
}

"use client";

import Link from "next/link";
import { Send } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import type { Message } from "@/modules/community/server/messages";
import { deleteMessageAction, sendMessageAction } from "@/modules/community/server/actions";
import { AppHeader } from "@/ui";
import { Avatar } from "@/ui/Avatar";
import { cx } from "@/ui/cx";

type Data = { other: { id: string; name: string; avatarUrl: string | null }; messages: Message[]; otherReadAt: string | null; canSend: boolean };
const hhmm = (iso: string) => new Date(iso).toLocaleTimeString("vi-VN", { hour: "2-digit", minute: "2-digit" });

/** Polls every 4 s while visible (no websockets on serverless); pauses when the tab is hidden. */
export function Chat({ conversationId, initial }: { conversationId: string; initial: Data }) {
  const [msgs, setMsgs] = useState(initial.messages);
  const [otherReadAt, setOtherReadAt] = useState(initial.otherReadAt);
  const [text, setText] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [sending, setSending] = useState(false);
  const end = useRef<HTMLDivElement>(null);
  const last = msgs.at(-1)?.createdAt;

  const poll = useCallback(async () => {
    if (document.hidden) return;
    try {
      const r = await fetch(`/api/messages/${conversationId}${last ? `?after=${encodeURIComponent(last)}` : ""}`, { cache: "no-store" });
      if (!r.ok) return;
      const d = (await r.json()) as Data;
      if (d.messages.length) setMsgs((m) => [...m, ...d.messages.filter((x) => !m.some((y) => y.id === x.id))]);
      setOtherReadAt(d.otherReadAt);
    } catch {
      /* offline: try again next tick */
    }
  }, [conversationId, last]);

  useEffect(() => {
    const t = setInterval(poll, 4000);
    return () => clearInterval(t);
  }, [poll]);
  useEffect(() => end.current?.scrollIntoView({ block: "end" }), [msgs.length]);

  async function send(e: React.FormEvent) {
    e.preventDefault();
    const body = text.trim();
    if (!body) return;
    setSending(true);
    setError(null);
    const r = await sendMessageAction(conversationId, body).catch(() => ({ ok: false as const, error: "Không gửi được. Kiểm tra mạng." }));
    setSending(false);
    if (!r.ok) return setError(r.error);
    setText("");
    setMsgs((m) => [...m, r.data]);
  }

  const lastMine = [...msgs].reverse().find((m) => m.mine);
  return (
    <>
      <AppHeader back backFallback="/messages" title={initial.other.name} />
      <div className="flex items-center gap-2 px-4 pb-2">
        <Link href={`/members/${initial.other.id}`} className="flex items-center gap-2 text-[13px] text-muted">
          <Avatar name={initial.other.name} url={initial.other.avatarUrl} size={28} /> Xem hồ sơ
        </Link>
      </div>
      <ol className="space-y-2 px-4 pb-4" aria-live="polite">
        {msgs.map((m) => (
          <li key={m.id} className={cx("flex", m.mine ? "justify-end" : "justify-start")}>
            <div className={cx("max-w-[80%] rounded-2xl px-3.5 py-2", m.mine ? "rounded-br-md bg-primary text-on-primary" : "rounded-bl-md bg-surface-2 text-ink")}>
              {m.deleted ? <p className="text-[14px] italic opacity-70">Tin nhắn đã bị gỡ</p> : <p className="text-[15px] whitespace-pre-line break-words">{m.body}</p>}
              <p className={cx("mt-0.5 flex items-center gap-2 text-[11px]", m.mine ? "justify-end opacity-80" : "text-muted")}>
                {hhmm(m.createdAt)}
                {m.mine && !m.deleted && (
                  <button type="button" className="underline" onClick={async () => (await deleteMessageAction(m.id)).ok && setMsgs((x) => x.map((y) => (y.id === m.id ? { ...y, deleted: true, body: "" } : y)))}>
                    Gỡ
                  </button>
                )}
              </p>
            </div>
          </li>
        ))}
        {lastMine && otherReadAt && otherReadAt >= lastMine.createdAt && <li className="text-right text-[11px] text-muted">Đã xem</li>}
        <div ref={end} />
      </ol>
      {initial.canSend ? (
        <form onSubmit={send} className="sticky bottom-[calc(var(--tabbar-h)+var(--safe-bottom))] border-t border-line bg-bg px-4 py-2">
          <div className="flex items-end gap-2">
            <label htmlFor="msg" className="sr-only">
              Nhập tin nhắn
            </label>
            <textarea
              id="msg"
              rows={1}
              value={text}
              onChange={(e) => setText(e.target.value)}
              maxLength={4000}
              placeholder="Nhập tin nhắn…"
              className="max-h-32 min-h-11 flex-1 resize-none rounded-[20px] border border-line bg-surface px-4 py-2.5 text-[15px] text-ink outline-none focus:border-primary"
            />
            <button type="submit" aria-label="Gửi" disabled={sending || !text.trim()} className="grid size-11 shrink-0 place-items-center rounded-full bg-primary text-on-primary disabled:opacity-50">
              <Send size={18} />
            </button>
          </div>
          {error && (
            <p className="mt-1 text-[13px] text-expense" role="alert">
              {error}
            </p>
          )}
        </form>
      ) : (
        <p className="px-4 pb-4 text-center text-[13px] text-muted">Không thể gửi tin nhắn trong cuộc trò chuyện này.</p>
      )}
    </>
  );
}

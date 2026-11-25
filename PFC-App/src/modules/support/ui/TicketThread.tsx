"use client";

import { useState } from "react";
import { closeTicketAction, replyTicketAction } from "@/platform/admin/console-actions";
import { Button } from "@/ui";
import { FormError, TextArea } from "@/ui/Form";
import { cx } from "@/ui/cx";
import { useAction } from "@/ui/use-action";

type Msg = { id: string; staff: boolean; author: string; body: string; at: string };

export function TicketThread({ id, messages, closed, viewerIsStaff }: { id: string; messages: Msg[]; closed: boolean; viewerIsStaff: boolean }) {
  const a = useAction();
  const c = useAction();
  const [body, setBody] = useState("");
  return (
    <div className="space-y-3">
      <ul className="space-y-2">
        {messages.map((m) => {
          const mine = m.staff === viewerIsStaff;
          return (
            <li key={m.id} className={cx("max-w-[85%] rounded-2xl px-4 py-2.5", mine ? "ml-auto bg-primary text-on-primary" : "bg-surface-2 text-ink")}>
              <p className={cx("text-[12px] font-semibold", mine ? "opacity-90" : "text-muted")}>{m.author}</p>
              <p className="text-[14px] whitespace-pre-line">{m.body}</p>
              <p className={cx("text-[11px]", mine ? "opacity-80" : "text-muted")}>{new Date(m.at).toLocaleString("vi-VN", { timeZone: "Asia/Ho_Chi_Minh" })}</p>
            </li>
          );
        })}
      </ul>
      {closed ? (
        <p className="rounded-xl bg-surface-2 px-4 py-3 text-center text-[13px] text-muted">Yêu cầu đã đóng. Trả lời để mở lại.</p>
      ) : null}
      <form
        className="space-y-2"
        onSubmit={(e) => {
          e.preventDefault();
          a.run(() => replyTicketAction(id, body), () => setBody(""));
        }}
      >
        <TextArea label="Trả lời" value={body} onChange={(e) => setBody(e.target.value)} maxLength={4000} />
        <FormError message={a.error ?? c.error} />
        <div className="grid grid-cols-2 gap-2">
          {!closed && (
            <Button variant="secondary" disabled={c.pending} onClick={() => c.run(() => closeTicketAction(id))}>
              Đóng yêu cầu
            </Button>
          )}
          <Button type="submit" disabled={a.pending || !body.trim()} className={closed ? "col-span-2" : ""}>
            Gửi
          </Button>
        </div>
      </form>
    </div>
  );
}

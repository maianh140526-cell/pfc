"use client";

import { useState } from "react";
import { decideReportAction } from "@/modules/community/server/actions";
import { Button } from "@/ui";
import { FormError } from "@/ui/Form";
import { useAction } from "@/ui/use-action";

export function DecideReport({ id, canHide }: { id: string; canHide: boolean }) {
  const a = useAction();
  const [note, setNote] = useState("");
  return (
    <div className="mt-3 space-y-2">
      <label className="sr-only" htmlFor={`note-${id}`}>
        Ghi chú
      </label>
      <input
        id={`note-${id}`}
        value={note}
        onChange={(e) => setNote(e.target.value)}
        maxLength={300}
        placeholder="Ghi chú / lý do (người đăng sẽ thấy nếu ẩn)"
        className="min-h-11 w-full rounded-[var(--radius-control)] border border-line bg-surface px-3 text-[14px] text-ink"
      />
      <div className="grid grid-cols-2 gap-2">
        <Button variant="secondary" className="min-h-10 text-[14px]" disabled={a.pending} onClick={() => a.run(() => decideReportAction(id, "dismiss", note))}>
          Không vi phạm
        </Button>
        {canHide && (
          <Button variant="danger" className="min-h-10 text-[14px]" disabled={a.pending} onClick={() => a.run(() => decideReportAction(id, "hide", note))}>
            Ẩn nội dung
          </Button>
        )}
      </div>
      <FormError message={a.error} />
    </div>
  );
}

"use client";

import { CheckCircle2, Trash2 } from "lucide-react";
import { useState } from "react";
import { checkInChallengeAction, deleteChallengeAction } from "@/modules/finance/server/actions";
import { Button } from "@/ui";
import { ConfirmSheet } from "@/ui/ConfirmSheet";
import { useAction } from "@/ui/use-action";

export function ChallengeActions({ id, canCheckIn, active }: { id: string; canCheckIn: boolean; active: boolean }) {
  const checkIn = useAction();
  const del = useAction();
  const [confirm, setConfirm] = useState(false);
  return (
    <>
      <div className="mt-3 flex gap-2">
        {active && (
          <Button className="min-h-10 flex-1 text-[14px]" disabled={!canCheckIn || checkIn.pending} onClick={() => checkIn.run(() => checkInChallengeAction(id))}>
            <CheckCircle2 size={18} /> {canCheckIn ? (checkIn.pending ? "Đang tính…" : "Check-in hôm nay") : "Đã check-in hôm nay"}
          </Button>
        )}
        <Button variant="ghost" className="min-h-10 px-3 text-expense" aria-label="Xóa thử thách" onClick={() => setConfirm(true)}>
          <Trash2 size={18} />
        </Button>
      </div>
      {checkIn.error && <p className="mt-2 text-[13px] text-expense">{checkIn.error}</p>}
      <ConfirmSheet
        open={confirm}
        onClose={() => setConfirm(false)}
        title="Xóa thử thách?"
        message="Thử thách và lịch sử check-in sẽ bị xóa vĩnh viễn."
        pending={del.pending}
        error={del.error}
        onConfirm={() => del.run(() => deleteChallengeAction(id), () => setConfirm(false))}
      />
    </>
  );
}

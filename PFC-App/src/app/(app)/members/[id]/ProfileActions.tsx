"use client";

import { Ban, MessageCircle } from "lucide-react";
import { useState } from "react";
import { messageMemberAction, toggleBlockAction } from "@/modules/community/server/actions";
import { ConfirmSheet } from "@/ui/ConfirmSheet";
import { FormError } from "@/ui/Form";
import { useAction } from "@/ui/use-action";
import { FollowButton, ReportLink } from "../../community/posts/[id]/PostClient";

export function ProfileActions({ memberId, following, blocked }: { memberId: string; following: boolean; blocked: boolean }) {
  const a = useAction();
  const [confirm, setConfirm] = useState(false);
  return (
    <div className="mt-2 w-full space-y-2">
      {!blocked && (
        <div className="flex justify-center gap-2">
          <FollowButton memberId={memberId} following={following} />
          <button type="button" disabled={a.pending} onClick={() => a.run(() => messageMemberAction(memberId))} className="flex min-h-9 items-center gap-1 rounded-full border border-line px-3 text-[13px] font-semibold text-ink">
            <MessageCircle size={15} /> Nhắn tin
          </button>
        </div>
      )}
      <FormError message={a.error} />
      <div className="flex justify-center gap-4 text-[12px] text-muted">
        <button type="button" className="flex items-center gap-1 font-semibold" onClick={() => (blocked ? a.run(() => toggleBlockAction(memberId)) : setConfirm(true))}>
          <Ban size={12} /> {blocked ? "Bỏ chặn" : "Chặn"}
        </button>
        <ReportLink targetType="member" targetId={memberId} />
      </div>
      <ConfirmSheet
        open={confirm}
        onClose={() => setConfirm(false)}
        title="Chặn thành viên này?"
        message="Họ không nhắn tin, theo dõi hay bình luận bài của bạn được; bài của họ ẩn khỏi bảng tin của bạn."
        confirmLabel="Chặn"
        pending={a.pending}
        error={a.error}
        onConfirm={() => a.run(() => toggleBlockAction(memberId), () => setConfirm(false))}
      />
    </div>
  );
}

"use client";

import { useRouter } from "next/navigation";
import { MoreHorizontal } from "lucide-react";
import { useState } from "react";
import type { GroupRole, GroupVisibility } from "@/modules/community/domain/rules";
import { archiveGroupAction, decideJoinAction, joinGroupAction, leaveGroupAction, removeFromGroupAction, setGroupRoleAction } from "@/modules/community/server/actions";
import { BottomSheet, Button } from "@/ui";
import { ConfirmSheet } from "@/ui/ConfirmSheet";
import { FormError, TextArea } from "@/ui/Form";
import { useAction } from "@/ui/use-action";

export function JoinGroup({ id, myStatus, myRole, visibility }: { id: string; myStatus: "active" | "requested" | null; myRole: GroupRole | null; visibility: GroupVisibility }) {
  const a = useAction();
  const [leave, setLeave] = useState(false);
  if (myStatus === "active") {
    return (
      <>
        <Button variant="secondary" block disabled={myRole === "owner"} onClick={() => setLeave(true)}>
          {myRole === "owner" ? "Bạn là chủ nhóm" : "Đã tham gia · Rời nhóm"}
        </Button>
        <ConfirmSheet open={leave} onClose={() => setLeave(false)} title="Rời nhóm?" message="Bạn có thể tham gia lại sau." confirmLabel="Rời nhóm" pending={a.pending} error={a.error} onConfirm={() => a.run(() => leaveGroupAction(id), () => setLeave(false))} />
      </>
    );
  }
  if (myStatus === "requested") {
    return (
      <Button variant="secondary" block disabled={a.pending} onClick={() => a.run(() => leaveGroupAction(id))}>
        Đang chờ duyệt · Rút yêu cầu
      </Button>
    );
  }
  return (
    <>
      <Button block disabled={a.pending} onClick={() => a.run(() => joinGroupAction(id))}>
        {visibility === "private" ? "Xin tham gia" : "Tham gia nhóm"}
      </Button>
      <FormError message={a.error} />
    </>
  );
}

export function PendingRequests({ groupId, pending }: { groupId: string; pending: { memberId: string; name: string }[] }) {
  const a = useAction();
  return (
    <ul className="divide-y divide-line overflow-hidden rounded-[var(--radius-card)] border border-line bg-surface">
      {pending.map((p) => (
        <li key={p.memberId} className="flex items-center gap-2 px-4 py-3">
          <span className="flex-1 truncate text-[15px] font-semibold text-ink">{p.name}</span>
          <Button variant="secondary" className="min-h-10 px-3 text-[13px]" disabled={a.pending} onClick={() => a.run(() => decideJoinAction(groupId, p.memberId, false))}>
            Từ chối
          </Button>
          <Button className="min-h-10 px-3 text-[13px]" disabled={a.pending} onClick={() => a.run(() => decideJoinAction(groupId, p.memberId, true))}>
            Duyệt
          </Button>
        </li>
      ))}
      {a.error && (
        <li className="px-4 py-2">
          <FormError message={a.error} />
        </li>
      )}
    </ul>
  );
}

/** Owner-only actions on a member row. */
export function MemberRow({ groupId, memberId, name, role }: { groupId: string; memberId: string; name: string; role: GroupRole }) {
  const a = useAction();
  const [open, setOpen] = useState(false);
  const [remove, setRemove] = useState(false);
  return (
    <>
      <button type="button" aria-label={`Tùy chọn cho ${name}`} onClick={() => setOpen(true)} className="grid size-10 place-items-center text-muted">
        <MoreHorizontal size={18} />
      </button>
      <BottomSheet open={open} onClose={() => setOpen(false)} title={name}>
        <div className="grid gap-2">
          <Button variant="secondary" block disabled={a.pending} onClick={() => a.run(() => setGroupRoleAction(groupId, memberId, role === "moderator" ? "member" : "moderator"), () => setOpen(false))}>
            {role === "moderator" ? "Bỏ quyền điều hành viên" : "Đặt làm điều hành viên"}
          </Button>
          <Button variant="ghost" block className="text-expense" onClick={() => (setOpen(false), setRemove(true))}>
            Loại khỏi nhóm
          </Button>
          <FormError message={a.error} />
        </div>
      </BottomSheet>
      <ConfirmSheet open={remove} onClose={() => setRemove(false)} title={`Loại ${name}?`} message="Người này rời nhóm và không thể tự tham gia lại." confirmLabel="Loại khỏi nhóm" pending={a.pending} error={a.error} onConfirm={() => a.run(() => removeFromGroupAction(groupId, memberId), () => setRemove(false))} />
    </>
  );
}

export function ArchiveGroup({ id, owner }: { id: string; owner: boolean }) {
  const router = useRouter();
  const a = useAction();
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState("");
  return (
    <>
      <Button variant="ghost" block className="text-expense" onClick={() => setOpen(true)}>
        Lưu trữ nhóm
      </Button>
      <BottomSheet
        open={open}
        onClose={() => setOpen(false)}
        title="Lưu trữ nhóm"
        footer={
          <Button variant="danger" block disabled={a.pending || (!owner && !reason.trim())} onClick={() => a.run(() => archiveGroupAction(id, reason), () => router.replace("/community/groups"))}>
            Lưu trữ
          </Button>
        }
      >
        <TextArea label={owner ? "Lý do (không bắt buộc)" : "Lý do (chủ nhóm sẽ thấy)"} value={reason} onChange={(e) => setReason(e.target.value)} maxLength={300} />
        <FormError message={a.error} />
      </BottomSheet>
    </>
  );
}

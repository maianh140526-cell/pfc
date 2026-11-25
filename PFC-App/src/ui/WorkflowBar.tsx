"use client";

import { useState } from "react";
import type { ContentStatus, WorkflowAction } from "@/platform/workflow";
import { STATUS_LABEL, STATUS_TONE } from "@/platform/workflow";
import { Badge } from "./States";
import { BottomSheet } from "./BottomSheet";
import { Button } from "./Button";
import { ConfirmSheet } from "./ConfirmSheet";
import { FormError, TextArea } from "./Form";

type Result = { ok: true } | { ok: false; error: string };

/**
 * Status + allowed workflow buttons for any reviewed content (courses, quizzes, listings, projects).
 * Buttons only reflect what the server accepts; the server re-checks every action.
 */
export function WorkflowBar({
  status,
  isAuthor,
  canApprove,
  rejectReason,
  onAction,
  onDelete,
  canDelete,
  submitLabel = "Gửi duyệt",
}: {
  status: ContentStatus;
  isAuthor: boolean;
  canApprove: boolean;
  rejectReason?: string | null;
  onAction: (action: WorkflowAction, reason?: string) => Promise<Result>;
  onDelete?: () => Promise<Result>;
  canDelete?: boolean;
  submitLabel?: string;
}) {
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [rejecting, setRejecting] = useState(false);
  const [reason, setReason] = useState("");
  const [confirmDelete, setConfirmDelete] = useState(false);

  async function go(action: WorkflowAction, r?: string) {
    setPending(true);
    setError(null);
    const res = await onAction(action, r);
    setPending(false);
    if (!res.ok) setError(res.error);
    else setRejecting(false);
  }

  const buttons: Array<{ action: WorkflowAction; label: string; variant: "primary" | "secondary" | "danger" | "ghost" }> = [];
  if (isAuthor && (status === "draft" || status === "rejected")) buttons.push({ action: "submit", label: canApprove ? "Xuất bản" : submitLabel, variant: "primary" });
  if (canApprove && status === "submitted") buttons.push({ action: "approve", label: "Duyệt & xuất bản", variant: "primary" });
  if (canApprove && (status === "submitted" || status === "published")) buttons.push({ action: "reject", label: "Từ chối", variant: "danger" });
  if ((canApprove || isAuthor) && status === "published") buttons.push({ action: "archive", label: "Gỡ xuống", variant: "secondary" });
  if (canApprove && status === "archived") buttons.push({ action: "restore", label: "Khôi phục", variant: "secondary" });

  return (
    <div className="space-y-3 rounded-[var(--radius-card)] border border-line bg-surface p-4">
      <div className="flex items-center justify-between gap-2">
        <span className="text-[13px] text-muted">Trạng thái</span>
        <Badge tone={STATUS_TONE[status]}>{STATUS_LABEL[status]}</Badge>
      </div>
      {status === "rejected" && rejectReason && (
        <p className="rounded-xl bg-expense-soft px-3 py-2 text-[13px] text-expense">Lý do từ chối: {rejectReason}</p>
      )}
      {status === "submitted" && isAuthor && !canApprove && <p className="text-[13px] text-muted">Đang chờ người có quyền duyệt. Bạn sẽ không sửa được cho đến khi có kết quả.</p>}
      {buttons.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {buttons.map((b) => (
            <Button
              key={b.action}
              variant={b.variant}
              className="min-h-10 flex-1 text-[14px]"
              disabled={pending}
              onClick={() => (b.action === "reject" ? setRejecting(true) : go(b.action))}
            >
              {b.label}
            </Button>
          ))}
        </div>
      )}
      {onDelete && canDelete && (
        <Button variant="ghost" className="min-h-10 w-full text-[14px] text-expense" onClick={() => setConfirmDelete(true)}>
          Xóa
        </Button>
      )}
      <FormError message={error} />
      <BottomSheet
        open={rejecting}
        onClose={() => setRejecting(false)}
        title="Từ chối nội dung"
        footer={
          <Button variant="danger" block disabled={pending || !reason.trim()} onClick={() => go("reject", reason)}>
            Từ chối
          </Button>
        }
      >
        <TextArea label="Lý do (tác giả sẽ thấy để sửa)" value={reason} onChange={(e) => setReason(e.target.value)} maxLength={500} />
      </BottomSheet>
      {onDelete && (
        <ConfirmSheet
          open={confirmDelete}
          onClose={() => setConfirmDelete(false)}
          title="Xóa vĩnh viễn?"
          message="Nội dung sẽ bị xóa và không khôi phục được."
          pending={pending}
          error={error}
          onConfirm={async () => {
            setPending(true);
            const r = await onDelete();
            setPending(false);
            if (!r.ok) setError(r.error);
            else setConfirmDelete(false);
          }}
        />
      )}
    </div>
  );
}

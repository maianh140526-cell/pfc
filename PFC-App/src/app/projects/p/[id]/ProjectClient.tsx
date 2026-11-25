"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Star } from "lucide-react";
import type { MemberRole, MemberStatus, ProjectAction, ProjectStatus } from "@/modules/projects/domain/projects";
import { PROJECT_STATUS_LABEL, PROJECT_STATUS_TONE } from "@/modules/projects/domain/projects";
import {
  cancelRequestAction,
  deleteProjectAction,
  giveFeedbackAction,
  leaveProjectAction,
  projectTransitionAction,
  requestToJoinAction,
  respondInviteAction,
  setFeedbackHiddenAction,
} from "@/modules/projects/server/actions";
import { Badge, BottomSheet, Button, Card } from "@/ui";
import { ConfirmSheet } from "@/ui/ConfirmSheet";
import { FormError, TextArea } from "@/ui/Form";
import { SegmentedTabs } from "@/ui/SegmentedTabs";
import { useAction } from "@/ui/use-action";

const ACTION_LABEL: Record<ProjectAction, string> = {
  submit: "Gửi duyệt dự án",
  approve: "Duyệt & công khai",
  reject: "Từ chối",
  complete: "Đánh dấu hoàn thành",
  reopen: "Mở lại dự án",
  archive: "Lưu trữ dự án",
  restore: "Khôi phục",
};
const HINT: Partial<Record<ProjectStatus, string>> = {
  draft: "Bản nháp chỉ bạn thấy. Gửi duyệt để công khai và tuyển thành viên.",
  submitted: "Đang chờ Chủ nhiệm / Ban điều hành / Trưởng ban Chuyên môn duyệt.",
  archived: "Dự án đã lưu trữ, không còn hiển thị công khai.",
};

/** PRO-26 Project Approval Status + lifecycle buttons (server re-checks every action). */
export function ProjectStatusBar({ id, status, actions, rejectReason, canDelete }: { id: string; status: ProjectStatus; actions: ProjectAction[]; rejectReason: string | null; canDelete: boolean }) {
  const router = useRouter();
  const a = useAction();
  const [rejecting, setRejecting] = useState(false);
  const [confirm, setConfirm] = useState<"archive" | "delete" | null>(null);
  const [reason, setReason] = useState("");
  const destructive = (x: ProjectAction) => x === "reject" || x === "archive";
  return (
    <Card className="p-4">
      <div className="flex items-center justify-between">
        <span className="text-[13px] text-muted">Trạng thái</span>
        <Badge tone={PROJECT_STATUS_TONE[status]}>{PROJECT_STATUS_LABEL[status]}</Badge>
      </div>
      {status === "rejected" && rejectReason && <p className="mt-2 rounded-xl bg-expense-soft p-3 text-[13px] text-expense">Lý do từ chối: {rejectReason}. Sửa rồi gửi duyệt lại.</p>}
      {HINT[status] && <p className="mt-2 text-[13px] text-ink-2">{HINT[status]}</p>}
      <div className="mt-3 grid gap-2">
        {actions
          .filter((x) => !destructive(x))
          .map((x) => (
            <Button key={x} block disabled={a.pending} variant={x === "approve" || x === "submit" ? "primary" : "secondary"} onClick={() => a.run(() => projectTransitionAction(id, x))}>
              {ACTION_LABEL[x]}
            </Button>
          ))}
        {actions.includes("reject") && (
          <Button block variant="secondary" className="text-expense" onClick={() => setRejecting(true)}>
            Từ chối
          </Button>
        )}
        {actions.includes("archive") && (
          <Button block variant="ghost" className="text-expense" onClick={() => setConfirm("archive")}>
            Lưu trữ dự án
          </Button>
        )}
        {canDelete && (
          <Button block variant="ghost" className="text-expense" onClick={() => setConfirm("delete")}>
            Xóa bản nháp
          </Button>
        )}
      </div>
      <FormError message={a.error} />
      <BottomSheet
        open={rejecting}
        onClose={() => setRejecting(false)}
        title="Từ chối dự án"
        footer={
          <Button variant="danger" block disabled={a.pending || !reason.trim()} onClick={() => a.run(() => projectTransitionAction(id, "reject", reason), () => setRejecting(false))}>
            Từ chối
          </Button>
        }
      >
        <TextArea label="Lý do (chủ dự án sẽ thấy)" value={reason} onChange={(e) => setReason(e.target.value)} maxLength={300} />
      </BottomSheet>
      <ConfirmSheet
        open={confirm !== null}
        onClose={() => setConfirm(null)}
        title={confirm === "delete" ? "Xóa bản nháp?" : "Lưu trữ dự án?"}
        message={confirm === "delete" ? "Bản nháp và mọi dữ liệu bên trong sẽ bị xóa vĩnh viễn." : "Dự án sẽ ẩn khỏi danh sách công khai. Người duyệt có thể khôi phục."}
        confirmLabel={confirm === "delete" ? "Xóa" : "Lưu trữ"}
        pending={a.pending}
        error={a.error}
        onConfirm={() =>
          confirm === "delete"
            ? a.run(() => deleteProjectAction(id), () => router.replace("/projects/mine"))
            : a.run(() => projectTransitionAction(id, "archive"), () => setConfirm(null))
        }
      />
    </Card>
  );
}

/** PRO-12/13 Apply to join / offer mentoring; answer an invitation; leave. */
export function JoinPanel({ id, myRole, myStatus, recruiting }: { id: string; myRole: MemberRole | null; myStatus: MemberStatus | null; recruiting: boolean }) {
  const a = useAction();
  const [open, setOpen] = useState(false);
  const [leaving, setLeaving] = useState(false);
  const [role, setRole] = useState<"member" | "mentor">(recruiting ? "member" : "mentor");
  const [message, setMessage] = useState("");

  if (myStatus === "invited") {
    return (
      <Card className="border-warning bg-warning-soft p-4">
        <p className="text-[14px] font-semibold text-ink">Bạn được mời tham gia dự án này{myRole ? "" : ""}.</p>
        <div className="mt-3 flex gap-2">
          <Button variant="secondary" className="flex-1" disabled={a.pending} onClick={() => a.run(() => respondInviteAction(id, false))}>
            Từ chối
          </Button>
          <Button className="flex-1" disabled={a.pending} onClick={() => a.run(() => respondInviteAction(id, true))}>
            Tham gia
          </Button>
        </div>
        <FormError message={a.error} />
      </Card>
    );
  }
  if (myStatus === "requested") {
    return (
      <Card className="p-4">
        <p className="text-[14px] text-ink">Đã gửi yêu cầu tham gia. Chủ dự án / Trưởng nhóm sẽ phản hồi.</p>
        <Button variant="ghost" block className="mt-2" disabled={a.pending} onClick={() => a.run(() => cancelRequestAction(id))}>
          Rút yêu cầu
        </Button>
        <FormError message={a.error} />
      </Card>
    );
  }
  if (myRole) {
    return (
      <>
        <Button variant="ghost" block className="text-expense" onClick={() => setLeaving(true)}>
          Rời dự án
        </Button>
        <ConfirmSheet
          open={leaving}
          onClose={() => setLeaving(false)}
          title="Rời dự án?"
          message="Các công việc đang giao cho bạn sẽ được bỏ giao. Bạn có thể xin tham gia lại sau."
          confirmLabel="Rời dự án"
          pending={a.pending}
          error={a.error}
          onConfirm={() => a.run(() => leaveProjectAction(id), () => setLeaving(false))}
        />
      </>
    );
  }
  if (myStatus === "removed") return <p className="text-[13px] text-muted">Bạn không còn là thành viên dự án này.</p>;

  return (
    <>
      <div className="grid gap-2">
        {recruiting && (
          <Button
            block
            onClick={() => {
              setRole("member");
              setOpen(true);
            }}
          >
            Xin tham gia dự án
          </Button>
        )}
        <Button
          block
          variant="secondary"
          onClick={() => {
            setRole("mentor");
            setOpen(true);
          }}
        >
          Đề nghị làm mentor
        </Button>
      </div>
      <BottomSheet
        open={open}
        onClose={() => setOpen(false)}
        title={role === "member" ? "Xin tham gia dự án" : "Đề nghị làm mentor"}
        footer={
          <Button block disabled={a.pending} onClick={() => a.run(() => requestToJoinAction(id, { role, message }), () => setOpen(false))}>
            Gửi yêu cầu
          </Button>
        }
      >
        {recruiting && (
          <div className="mb-3">
            <SegmentedTabs
              label="Vai trò"
              stretch
              value={role}
              onChange={setRole}
              options={[
                { value: "member", label: "Thành viên" },
                { value: "mentor", label: "Mentor" },
              ]}
            />
          </div>
        )}
        <TextArea
          label={role === "member" ? "Giới thiệu bản thân & kỹ năng bạn đóng góp" : "Kinh nghiệm & phạm vi bạn có thể hỗ trợ"}
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          maxLength={500}
        />
        <FormError message={a.error} />
      </BottomSheet>
    </>
  );
}

type Fb = { id: string; authorName: string; rating: number; comment: string; hidden: boolean; createdAt: string; mine: boolean };

/** PRO-20 Feedback & Rating with moderation for approvers. */
export function FeedbackPanel({ id, canGive, mine, feedback, canModerate }: { id: string; canGive: boolean; mine: { rating: number; comment: string } | null; feedback: Fb[]; canModerate: boolean }) {
  const a = useAction();
  const [rating, setRating] = useState(mine?.rating ?? 5);
  const [comment, setComment] = useState(mine?.comment ?? "");
  const [saved, setSaved] = useState(false);
  return (
    <div className="space-y-3">
      {canGive && (
        <Card className="p-4">
          <p className="text-[14px] font-semibold text-ink">{mine ? "Đánh giá của bạn" : "Góp ý cho dự án"}</p>
          <div className="my-2 flex gap-1" role="radiogroup" aria-label="Số sao">
            {[1, 2, 3, 4, 5].map((n) => (
              <button key={n} type="button" role="radio" aria-checked={rating === n} aria-label={`${n} sao`} onClick={() => setRating(n)} className="p-0.5">
                <Star size={28} className={n <= rating ? "fill-warning text-warning" : "text-line"} />
              </button>
            ))}
          </div>
          <TextArea label="Nhận xét (không bắt buộc)" value={comment} onChange={(e) => setComment(e.target.value)} maxLength={1000} />
          <FormError message={a.error} />
          {saved && <p className="text-[13px] font-semibold text-income">Đã lưu đánh giá.</p>}
          <Button block className="mt-2" disabled={a.pending} onClick={() => a.run(() => giveFeedbackAction(id, { rating, comment }), () => setSaved(true))}>
            {mine ? "Cập nhật đánh giá" : "Gửi đánh giá"}
          </Button>
        </Card>
      )}
      {feedback.length === 0 ? (
        <p className="text-[14px] text-muted">Chưa có phản hồi.</p>
      ) : (
        <ul className="space-y-2">
          {feedback.map((f) => (
            <li key={f.id} className="rounded-[var(--radius-card)] border border-line bg-surface p-3.5">
              <div className="flex items-center justify-between gap-2">
                <p className="text-[14px] font-semibold text-ink">
                  {f.authorName}
                  {f.mine && <span className="text-muted"> (bạn)</span>}
                </p>
                <span className="flex items-center gap-0.5 text-[13px] text-ink-2">
                  <Star size={14} className="fill-warning text-warning" /> {f.rating}
                </span>
              </div>
              {f.comment && <p className="mt-1 text-[14px] text-ink-2">{f.comment}</p>}
              {f.hidden && <p className="mt-1 text-[12px] font-semibold text-expense">Đã bị ẩn bởi kiểm duyệt</p>}
              {canModerate && (
                <button type="button" className="mt-1 text-[13px] font-semibold text-primary" disabled={a.pending} onClick={() => a.run(() => setFeedbackHiddenAction(f.id, !f.hidden))}>
                  {f.hidden ? "Hiện lại" : "Ẩn phản hồi"}
                </button>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

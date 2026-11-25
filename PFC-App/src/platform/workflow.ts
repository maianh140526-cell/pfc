/**
 * Shared publish workflow for user/staff content (SRS §9 Content, BR-010): pure, unit tested.
 *
 *   draft ──submit──▶ submitted ──approve──▶ published ──archive──▶ archived
 *     ▲                  │                      ▲                      │
 *     └──── (edit) ── rejected ◀──reject───────┘ (restore) ◀──────────┘
 *
 * - Authors submit their own drafts/rejected items; editing goes back to draft.
 * - Approvers (a hub-specific permission) approve/reject submitted items and archive/restore.
 * - An author who is also an approver may publish their own draft directly (no self-review step).
 * - Authors may archive (unpublish) their own published content.
 */
export const CONTENT_STATUSES = ["draft", "submitted", "published", "rejected", "archived"] as const;
export type ContentStatus = (typeof CONTENT_STATUSES)[number];
export type WorkflowAction = "submit" | "approve" | "reject" | "archive" | "restore";

export const STATUS_LABEL: Record<ContentStatus, string> = {
  draft: "Nháp",
  submitted: "Chờ duyệt",
  published: "Đã xuất bản",
  rejected: "Bị từ chối",
  archived: "Đã gỡ",
};

export const STATUS_TONE: Record<ContentStatus, "muted" | "warning" | "income" | "expense"> = {
  draft: "muted",
  submitted: "warning",
  published: "income",
  rejected: "expense",
  archived: "muted",
};

export function isContentStatus(v: unknown): v is ContentStatus {
  return typeof v === "string" && (CONTENT_STATUSES as readonly string[]).includes(v);
}

export type WorkflowResult = { ok: true; to: ContentStatus } | { ok: false; error: string };

export function applyWorkflow(
  action: WorkflowAction,
  from: ContentStatus,
  who: { isAuthor: boolean; canApprove: boolean },
  reason?: string,
): WorkflowResult {
  const deny = (error: string): WorkflowResult => ({ ok: false, error });
  switch (action) {
    case "submit":
      if (!who.isAuthor) return deny("Chỉ tác giả được gửi duyệt.");
      if (from !== "draft" && from !== "rejected") return deny("Chỉ gửi duyệt được bản nháp hoặc bản bị từ chối.");
      return { ok: true, to: who.canApprove ? "published" : "submitted" };
    case "approve":
      if (!who.canApprove) return deny("Bạn không có quyền duyệt nội dung này.");
      if (from !== "submitted") return deny("Chỉ duyệt được nội dung đang chờ duyệt.");
      return { ok: true, to: "published" };
    case "reject":
      if (!who.canApprove) return deny("Bạn không có quyền duyệt nội dung này.");
      if (from !== "submitted" && from !== "published") return deny("Không thể từ chối ở trạng thái này.");
      if (!reason?.trim()) return deny("Cần ghi lý do từ chối để tác giả sửa.");
      return { ok: true, to: "rejected" };
    case "archive":
      if (!who.canApprove && !who.isAuthor) return deny("Bạn không có quyền gỡ nội dung này.");
      if (from !== "published") return deny("Chỉ gỡ được nội dung đã xuất bản.");
      return { ok: true, to: "archived" };
    case "restore":
      if (!who.canApprove) return deny("Bạn không có quyền khôi phục nội dung.");
      if (from !== "archived") return deny("Chỉ khôi phục được nội dung đã gỡ.");
      return { ok: true, to: "published" };
  }
}

/** Editing content: authors edit draft/rejected; approvers may also fix submitted/published. */
export function canEditContent(status: ContentStatus, who: { isAuthor: boolean; canApprove: boolean }): boolean {
  if (who.canApprove) return status !== "archived";
  return who.isAuthor && (status === "draft" || status === "rejected");
}

/** Only published content is visible to people who are neither author nor approver. */
export function canViewContent(status: ContentStatus, who: { isAuthor: boolean; canApprove: boolean }): boolean {
  return status === "published" || who.isAuthor || who.canApprove;
}

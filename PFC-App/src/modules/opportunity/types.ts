/** Response shapes of the Opportunity Hub API (PFC-Opportunity Hub/web, Prisma models). */
export type OppType = "INTERNSHIP" | "JOB" | "COMPETITION" | "SCHOLARSHIP";
export type ProviderTier = "UNVERIFIED" | "VERIFIED_PROVIDER" | "TRUSTED_PARTNER";
export type OppStatus = "DRAFT" | "PENDING" | "VERIFIED" | "REJECTED" | "EXPIRED";
export type ApplyMode = "INTERNAL" | "EXTERNAL" | "BOTH";
export type AppStatus = "DRAFT" | "SUBMITTED" | "UNDER_REVIEW" | "ACCEPTED" | "REJECTED" | "WITHDRAWN" | "REDIRECTED" | "CLOSED";
export type Role = "MEMBER" | "PROVIDER" | "REVIEWER";

export type Opportunity = {
  id: string;
  type: OppType;
  employmentType: "CTV" | "PART_TIME" | "FULL_TIME" | null;
  title: string;
  summary: string | null;
  description: string;
  requirements: string | null;
  benefits: string | null;
  locationText: string | null;
  workMode: "ONSITE" | "REMOTE" | "HYBRID";
  deadlineAt: string | null;
  expireAt: string | null;
  applyMode: ApplyMode;
  externalUrl: string | null;
  status: OppStatus;
  publishedAt: string | null;
  updatedAt: string;
  provider?: { id?: string; displayName: string; verificationTier: ProviderTier };
};

export type OppList = { items: Opportunity[]; page: number; pageSize: number; total: number; totalPages: number };

export type Application = {
  id: string;
  opportunityId: string;
  channel: "INTERNAL" | "EXTERNAL";
  status: AppStatus;
  coverLetter: string | null;
  createdAt: string;
  updatedAt: string;
  attachmentId: string | null;
  opportunity: { id: string; title: string; type: OppType; deadlineAt?: string | null; provider?: { displayName: string } };
  history: Array<{ id: string; fromStatus: string | null; toStatus: string; note: string | null; createdAt: string }>;
  member?: { id: string; name: string; email: string };
};

export type OppNotification = { id: string; title: string; body: string; deepLink: string | null; readAt: string | null; createdAt: string };
export type OppUser = { id: string; email: string; name: string; role: Role };

export const TYPE_LABEL: Record<OppType, string> = {
  INTERNSHIP: "Thực tập",
  JOB: "Việc làm",
  COMPETITION: "Cuộc thi",
  SCHOLARSHIP: "Học bổng",
};

export const EMPLOYMENT_LABEL = { CTV: "CTV", PART_TIME: "Bán thời gian", FULL_TIME: "Toàn thời gian" } as const;
export const WORKMODE_LABEL = { ONSITE: "Tại văn phòng", REMOTE: "Từ xa", HYBRID: "Linh hoạt" } as const;

export const TIER_LABEL: Record<ProviderTier, string | null> = {
  UNVERIFIED: null,
  VERIFIED_PROVIDER: "Đơn vị đã xác minh",
  TRUSTED_PARTNER: "Đối tác tin cậy",
};

export const APP_STATUS: Record<AppStatus, { label: string; tone: "primary" | "income" | "expense" | "warning" | "muted" }> = {
  DRAFT: { label: "Nháp", tone: "muted" },
  REDIRECTED: { label: "Đã mở trang ứng tuyển", tone: "warning" },
  SUBMITTED: { label: "Đã nộp", tone: "primary" },
  UNDER_REVIEW: { label: "Đang xem xét", tone: "warning" },
  ACCEPTED: { label: "Được chấp nhận", tone: "income" },
  REJECTED: { label: "Chưa phù hợp", tone: "expense" },
  WITHDRAWN: { label: "Đã rút", tone: "muted" },
  CLOSED: { label: "Đã đóng", tone: "muted" },
};

export const OPP_STATUS: Record<OppStatus, { label: string; tone: "primary" | "income" | "expense" | "warning" | "muted" }> = {
  DRAFT: { label: "Nháp", tone: "muted" },
  PENDING: { label: "Chờ xác minh", tone: "warning" },
  VERIFIED: { label: "Đã xác minh", tone: "income" },
  REJECTED: { label: "Bị từ chối", tone: "expense" },
  EXPIRED: { label: "Hết hạn", tone: "muted" },
};

/** Whole days until a deadline (negative = passed), in the viewer's local time. */
export function daysUntil(iso: string | null, now = new Date()): number | null {
  if (!iso) return null;
  return Math.ceil((new Date(iso).getTime() - now.getTime()) / 86_400_000);
}

export function formatDate(iso: string | null): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("vi-VN", { day: "2-digit", month: "2-digit", year: "numeric" });
}

export function newIdempotencyKey(): string {
  return `pfc-${crypto.randomUUID()}`;
}

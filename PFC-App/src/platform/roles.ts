/**
 * PFC platform roles & permissions (FR-CORE-003/004, BR-002). Pure — no DB/Next imports.
 *
 * Same vocabulary as the Club (ADR-003 positions) so one account means the same thing
 * everywhere. Club operations keep using Club's own server-side matrix; this matrix governs
 * PFC-native hubs (Education, Marketplace, Project) and platform administration.
 *
 * Principle: deny by default. A member can always manage *their own* content; acting on
 * someone else's content or account needs an explicit permission below.
 */
export const ROLES = ["chu_nhiem", "ban_dieu_hanh", "truong_ban", "thanh_vien"] as const;
export type Role = (typeof ROLES)[number];

export const DEPARTMENTS = ["chuyen_mon", "truyen_thong", "su_kien"] as const;
export type Department = (typeof DEPARTMENTS)[number];

export const ROLE_LABEL: Record<Role, string> = {
  chu_nhiem: "Chủ nhiệm",
  ban_dieu_hanh: "Ban điều hành",
  truong_ban: "Trưởng ban",
  thanh_vien: "Thành viên",
};

export const DEPARTMENT_LABEL: Record<Department, string> = {
  chuyen_mon: "Ban Chuyên môn",
  truyen_thong: "Ban Truyền thông",
  su_kien: "Ban Sự kiện",
};

export const PERMISSIONS = {
  // Education Hub
  "edu.content.create": "Tạo nội dung học tập không giới hạn số lượng (mọi thành viên đều đóng góp được, tối đa 10 mục/ngày)",
  "edu.content.approve": "Duyệt / xuất bản / gỡ nội dung học tập của người khác",
  "edu.content.delete_any": "Xóa nội dung học tập của người khác",
  "edu.forum.moderate": "Ẩn / khóa bài viết diễn đàn của người khác",
  // Marketplace
  "mkt.listing.approve": "Duyệt / từ chối / gỡ tin đăng bán",
  "mkt.seller.approve": "Duyệt người bán",
  // Project Marketplace
  "project.approve": "Duyệt / từ chối dự án để công khai",
  "project.archive_any": "Lưu trữ dự án của người khác",
  "project.manage_any": "Can thiệp mọi dự án: mời / loại thành viên, đổi vai trò, ẩn phản hồi",
  // Opportunity feed
  "opp.post": "Đăng cơ hội (việc làm, thực tập, học bổng, cuộc thi) hiển thị trong PFC",
  // Community Hub
  "community.moderate": "Ẩn bài viết / bình luận, xử lý báo cáo vi phạm, lưu trữ nhóm cộng đồng",
  // Shared Event Engine
  "event.approve": "Duyệt / từ chối / hủy sự kiện để công khai",
  // Payments
  "payments.view": "Xem giao dịch thanh toán, hoàn tiền, đối soát",
  "payments.manage": "Duyệt hoàn tiền, ghi nhận chi trả cho người bán",
  // Platform administration
  "admin.members.view": "Xem danh sách tài khoản",
  "admin.roles.manage": "Phân vai trò cho tài khoản khác",
  "admin.members.lock": "Khóa / mở khóa tài khoản",
  "admin.members.restrict": "Hạn chế tạm thời: đăng bài, nhắn tin, bán hàng, tổ chức sự kiện",
  "admin.dashboard": "Xem bảng điều khiển quản trị, hàng chờ kiểm duyệt chung",
  "admin.audit.view": "Xem nhật ký hệ thống và sự kiện bảo mật",
  "admin.settings.manage": "Bật / tắt tính năng, cấu hình điểm thưởng và hạng thành viên",
  "admin.broadcast": "Gửi thông báo chung tới thành viên",
  "admin.support": "Trả lời yêu cầu hỗ trợ",
  "rewards.manage": "Quản lý quà tặng, duyệt đổi quà, điều chỉnh điểm",
  // Finance community content (Ngon – Bổ – Rẻ)
  "places.moderate": "Ẩn địa điểm / đánh giá vi phạm",
} as const;
export type Permission = keyof typeof PERMISSIONS;

/** Department-scoped grants for Trưởng ban. */
const DEPARTMENT_GRANTS: Record<Department, Permission[]> = {
  chuyen_mon: ["opp.post", "edu.content.create", "edu.content.approve", "edu.forum.moderate", "project.approve"],
  truyen_thong: ["opp.post", "edu.forum.moderate", "mkt.listing.approve", "community.moderate", "places.moderate", "admin.broadcast"],
  su_kien: ["opp.post", "edu.forum.moderate", "event.approve"],
};

const ROLE_GRANTS: Record<Role, Permission[] | "all"> = {
  chu_nhiem: "all",
  ban_dieu_hanh: [
    "opp.post",
    "edu.content.create",
    "edu.content.approve",
    "edu.forum.moderate",
    "mkt.listing.approve",
    "mkt.seller.approve",
    "project.approve",
    "project.archive_any",
    "community.moderate",
    "event.approve",
    "payments.view",
    "admin.members.view",
    "admin.members.restrict",
    "admin.dashboard",
    "admin.audit.view",
    "admin.broadcast",
    "admin.support",
    "rewards.manage",
    "places.moderate",
  ],
  truong_ban: [],
  thanh_vien: [],
};

export type Actor = { id: string; role: Role; department: Department | null; locked?: boolean };

export function permissionsOf(actor: Pick<Actor, "role" | "department" | "locked">): Set<Permission> {
  if (actor.locked) return new Set();
  const grants = ROLE_GRANTS[actor.role];
  if (grants === "all") return new Set(Object.keys(PERMISSIONS) as Permission[]);
  const set = new Set<Permission>(grants);
  if (actor.role === "truong_ban" && actor.department) for (const p of DEPARTMENT_GRANTS[actor.department]) set.add(p);
  return set;
}

export function can(actor: Pick<Actor, "role" | "department" | "locked"> | null | undefined, permission: Permission): boolean {
  return !!actor && permissionsOf(actor).has(permission);
}

/** Owner of a resource, or someone with the given "any" permission. */
export function canManageResource(actor: Actor | null | undefined, ownerId: string, anyPermission: Permission): boolean {
  if (!actor || actor.locked) return false;
  return actor.id === ownerId || can(actor, anyPermission);
}

export function isRole(v: unknown): v is Role {
  return typeof v === "string" && (ROLES as readonly string[]).includes(v);
}
export function isDepartment(v: unknown): v is Department {
  return typeof v === "string" && (DEPARTMENTS as readonly string[]).includes(v);
}

/** Role-change policy: only Chủ nhiệm; never leave the platform without a Chủ nhiệm. */
export function checkRoleChange(input: {
  actor: Actor;
  targetId: string;
  targetRole: Role;
  newRole: Role;
  ownerCount: number;
}): string | null {
  if (!can(input.actor, "admin.roles.manage")) return "Chỉ Chủ nhiệm được phân quyền.";
  if (input.targetRole === "chu_nhiem" && input.newRole !== "chu_nhiem" && input.ownerCount <= 1) {
    return "Phải luôn còn ít nhất một Chủ nhiệm.";
  }
  return null;
}

/** Human summary used on the "Phân quyền" screen. */
export const CLUB_MATRIX: ReadonlyArray<{ position: string; can: string; cannot: string }> = [
  { position: "Chủ nhiệm", can: "Toàn bộ chức năng: thành viên, phân quyền, công việc, hoạt động, tài liệu, báo cáo, nhật ký.", cannot: "—" },
  {
    position: "Ban điều hành",
    can: "Duyệt & quản lý thành viên, phân quyền, giao/duyệt việc, hoạt động, tài liệu, báo cáo.",
    cannot: "Chuyển quyền Chủ nhiệm.",
  },
  {
    position: "Trưởng ban Chuyên môn",
    can: "Giao việc, duyệt việc, quản lý hoạt động & tài liệu, xem báo cáo.",
    cannot: "Duyệt/kick thành viên, đổi vai trò.",
  },
  {
    position: "Trưởng ban Truyền thông",
    can: "Giao việc, quản lý hoạt động & tài liệu, xem báo cáo.",
    cannot: "Duyệt việc, duyệt/kick thành viên, đổi vai trò.",
  },
  {
    position: "Trưởng ban Sự kiện",
    can: "Giao việc, quản lý hoạt động, liên kết sự kiện, xem báo cáo.",
    cannot: "Duyệt việc, duyệt/kick thành viên, đổi vai trò.",
  },
  {
    position: "Thành viên",
    can: "Xem CLB & thành viên, làm việc được giao, tham gia hoạt động, bình luận.",
    cannot: "Xóa / kick bất kỳ ai, duyệt, giao việc, đổi vai trò.",
  },
];

/** Roles inside one project (FR-PROJ-002/003, BR-006). Enforced in modules/projects/domain/projects.ts. */
export const PROJECT_MATRIX: ReadonlyArray<{ position: string; can: string; cannot: string }> = [
  {
    position: "Chủ dự án",
    can: "Sửa & gửi duyệt dự án, mời / duyệt / loại thành viên, đổi vai trò, quản lý mentor, công việc, tài liệu, demo, xem thống kê, hoàn thành / lưu trữ.",
    cannot: "Tự đánh giá dự án của mình; rời dự án (phải lưu trữ).",
  },
  {
    position: "Trưởng nhóm",
    can: "Mời & duyệt thành viên mới, giao / sửa mọi công việc, thêm tài liệu & demo, xem thống kê.",
    cannot: "Loại (kick) thành viên, đổi vai trò, sửa / lưu trữ dự án.",
  },
  {
    position: "Thành viên dự án",
    can: "Xem không gian làm việc, tạo việc, cập nhật việc của mình, đăng cập nhật / thảo luận, rời dự án.",
    cannot: "Xóa / kick bất kỳ ai, duyệt người xin vào, sửa việc của người khác.",
  },
  {
    position: "Mentor",
    can: "Xem không gian làm việc, góp ý trong thảo luận, theo phạm vi đã thỏa thuận.",
    cannot: "Kick thành viên, sửa công việc, sửa dự án.",
  },
  {
    position: "Chủ nhiệm (toàn hệ thống)",
    can: "Can thiệp mọi dự án: duyệt, lưu trữ, loại thành viên, ẩn phản hồi.",
    cannot: "Loại Chủ dự án khỏi dự án của họ.",
  },
];

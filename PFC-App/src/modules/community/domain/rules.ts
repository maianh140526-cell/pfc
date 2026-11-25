/**
 * Community Hub rules (COM-01…22, mockups 73–84). Pure and unit tested.
 * Same principle as everywhere in PFC: members never remove anyone; group owners do, moderators
 * admit members and hide content; platform moderators (community.moderate) can step in anywhere.
 */
export const TOPICS = {
  finance: "Tài chính",
  growth: "Phát triển bản thân",
  invest: "Đầu tư",
  career: "Công việc",
  health: "Sức khỏe",
  other: "Khác",
} as const;
export type Topic = keyof typeof TOPICS;
export const isTopic = (v: unknown): v is Topic => typeof v === "string" && v in TOPICS;

/** #hashtags in Vietnamese text: letters/digits/_ after '#', lower-cased, unique, max 10. */
export function extractTags(text: string): string[] {
  const out = new Set<string>();
  for (const m of text.matchAll(/(^|[^\p{L}\p{N}_&])#([\p{L}\p{N}_]{2,30})/gu)) {
    out.add(m[2].toLowerCase());
    if (out.size >= 10) break;
  }
  return [...out];
}

export function validatePoll(options: unknown): string[] | string {
  if (options === undefined || options === null) return [];
  if (!Array.isArray(options)) return "Bình chọn không hợp lệ.";
  const clean = options.map((o) => (typeof o === "string" ? o.trim() : "")).filter(Boolean);
  if (clean.length === 0) return [];
  if (clean.length < 2) return "Bình chọn cần ít nhất 2 lựa chọn.";
  if (clean.length > 6) return "Bình chọn tối đa 6 lựa chọn.";
  if (clean.some((o) => o.length > 80)) return "Mỗi lựa chọn tối đa 80 ký tự.";
  if (new Set(clean.map((o) => o.toLowerCase())).size !== clean.length) return "Các lựa chọn không được trùng nhau.";
  return clean;
}

// ───────────── Groups ─────────────

export type GroupRole = "owner" | "moderator" | "member";
export type GroupVisibility = "public" | "private";
export const GROUP_ROLE_LABEL: Record<GroupRole, string> = { owner: "Chủ nhóm", moderator: "Điều hành viên", member: "Thành viên" };

export type GroupCaps = { viewContent: boolean; post: boolean; moderate: boolean; admit: boolean; removeMembers: boolean; changeRoles: boolean; editGroup: boolean };

/** role = active membership role or null; platformMod = community.moderate. */
export function groupCaps(role: GroupRole | null, visibility: GroupVisibility, platformMod: boolean): GroupCaps {
  const owner = role === "owner";
  const mod = owner || role === "moderator";
  return {
    viewContent: visibility === "public" || role !== null || platformMod,
    post: role !== null,
    moderate: mod || platformMod,
    admit: mod,
    removeMembers: owner,
    changeRoles: owner,
    editGroup: owner || role === "moderator",
  };
}

/** Owner removes anyone but themself; nobody else removes members (moderators admit + hide content only). */
export function canRemoveFromGroup(actorRole: GroupRole | null, targetRole: GroupRole): boolean {
  return actorRole === "owner" && targetRole !== "owner";
}

// ───────────── Posts & messages ─────────────

export type PostStatus = "draft" | "published" | "hidden" | "deleted";

/** Who may read a post: published + group content visible; authors always see their own (drafts, hidden). */
export function canReadPost(p: { status: PostStatus; authorId: string; groupVisible: boolean }, actorId: string | null, moderator: boolean): boolean {
  if (p.status === "deleted") return false;
  if (actorId && p.authorId === actorId) return true;
  if (p.status === "hidden") return moderator;
  if (p.status === "draft") return false;
  return p.groupVisible || moderator;
}

export type MessagePolicy = "members" | "following" | "none";

/**
 * Can `sender` start a conversation with `recipient`?
 * "following" = the recipient follows the sender. Blocks in either direction stop it.
 */
export function canStartConversation(policy: MessagePolicy, recipientFollowsSender: boolean, blocked: boolean, self: boolean): boolean {
  if (self || blocked) return false;
  if (policy === "none") return false;
  if (policy === "following") return recipientFollowsSender;
  return true;
}

export const REPORT_REASONS = {
  spam: "Spam / quảng cáo",
  harassment: "Quấy rối, xúc phạm",
  misinformation: "Thông tin sai lệch",
  scam: "Lừa đảo",
  privacy: "Lộ thông tin cá nhân",
  other: "Khác",
} as const;
export type ReportReason = keyof typeof REPORT_REASONS;
export type ReportTarget = "post" | "comment" | "group" | "member" | "message";

/** A direct conversation between two people is unique: the key does not depend on who started it. */
export const pairKey = (a: string, b: string) => [a, b].sort().join(":");

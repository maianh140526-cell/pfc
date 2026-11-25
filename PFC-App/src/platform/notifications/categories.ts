/**
 * Notification categories × channels (NOT-03/04/05, mockup 271). Pure: shared by server and UI.
 * "account" (security) cannot be switched off in-app or by email — people must hear about new sign-ins.
 */
export const CATEGORIES = {
  account: { label: "Bảo mật tài khoản", description: "Đăng nhập mới, đổi mật khẩu, xác thực hai lớp", locked: true },
  market: { label: "Đơn hàng & cửa hàng", description: "Đơn mới, trạng thái đơn, duyệt tin đăng", locked: false },
  projects: { label: "Dự án", description: "Lời mời, yêu cầu tham gia, việc được giao, phản hồi", locked: false },
  learn: { label: "Học tập & diễn đàn", description: "Nội dung được duyệt, trả lời bài viết của bạn", locked: false },
  community: { label: "Cộng đồng", description: "Bình luận, người theo dõi mới, nhóm", locked: false },
  messages: { label: "Tin nhắn", description: "Tin nhắn mới", locked: false },
  events: { label: "Sự kiện & vé", description: "Đăng ký, vé, nhắc lịch, thay đổi sự kiện", locked: false },
  payments: { label: "Thanh toán & hoàn tiền", description: "Thanh toán thành công / thất bại, hoàn tiền", locked: false },
  rewards: { label: "Điểm thưởng", description: "Cộng điểm, lên hạng, đổi quà", locked: false },
  announcements: { label: "Thông báo từ PFC", description: "Tin chung do Ban điều hành gửi", locked: false },
  support: { label: "Hỗ trợ", description: "Trả lời yêu cầu hỗ trợ của bạn", locked: false },
} as const;
export type Category = keyof typeof CATEGORIES;
export const CHANNELS = ["inapp", "email", "push"] as const;
export type Channel = (typeof CHANNELS)[number];
export const CHANNEL_LABEL: Record<Channel, string> = { inapp: "Trong ứng dụng", email: "Email", push: "Thông báo đẩy" };

/** Defaults when the member never touched the setting. Email for learning is off (low urgency). */
export const DEFAULT_PREFS: Record<Category, Record<Channel, boolean>> = {
  account: { inapp: true, email: true, push: true },
  market: { inapp: true, email: true, push: true },
  projects: { inapp: true, email: true, push: true },
  learn: { inapp: true, email: false, push: true },
  community: { inapp: true, email: false, push: true },
  messages: { inapp: true, email: false, push: true },
  events: { inapp: true, email: true, push: true },
  payments: { inapp: true, email: true, push: true },
  rewards: { inapp: true, email: false, push: false },
  announcements: { inapp: true, email: false, push: true },
  support: { inapp: true, email: true, push: true },
};

export function isCategory(v: unknown): v is Category {
  return typeof v === "string" && v in CATEGORIES;
}

/** Effective preference: stored value, else default; locked categories always deliver in-app + email. */
export function effectivePref(category: Category, channel: Channel, stored: Partial<Record<string, boolean>>): boolean {
  if (CATEGORIES[category].locked && channel !== "push") return true;
  const v = stored[`${category}:${channel}`];
  return typeof v === "boolean" ? v : DEFAULT_PREFS[category][channel];
}

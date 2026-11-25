import "server-only";
import { providerConfig } from "@/platform/auth/oauth";
import { publicUrl } from "@/platform/mail";
import type { AuthNotice } from "./AuthForm";

/** Which social buttons are live (secrets stay on the server; the page only gets booleans). */
export function enabledProviders() {
  return {
    google: !!providerConfig("google", process.env, publicUrl()),
    facebook: !!providerConfig("facebook", process.env, publicUrl()),
  };
}

const ERRORS: Record<string, string> = {
  oauth_unconfigured: "Hình thức đăng nhập này chưa được bật trên máy chủ. Hãy dùng email và mật khẩu.",
  oauth_cancelled: "Bạn đã hủy đăng nhập bằng mạng xã hội.",
  oauth_state: "Phiên đăng nhập đã hết hạn hoặc không hợp lệ. Vui lòng thử lại.",
  oauth_failed: "Không đăng nhập được bằng mạng xã hội lúc này. Vui lòng thử lại hoặc dùng email.",
  oauth_invalid: "Hình thức đăng nhập không hợp lệ.",
  no_email: "Tài khoản mạng xã hội không chia sẻ email. Hãy cấp quyền email hoặc đăng nhập bằng email.",
  email_conflict: "Email này đã có tài khoản PFC. Hãy đăng nhập bằng email và mật khẩu.",
  locked: "Tài khoản đã bị khóa. Liên hệ Chủ nhiệm PFC để được hỗ trợ.",
  "2fa_expired": "Phiên xác thực hai lớp đã hết hạn. Vui lòng đăng nhập lại.",
};

/** Maps ?error= / ?reset= / ?verified= from redirects to a message (unknown codes are ignored). */
export function noticeFrom(q: { error?: string; reset?: string; verified?: string; deleted?: string }): AuthNotice {
  if (q.deleted === "1") return { tone: "success", text: "Tài khoản của bạn đã được xóa. Cảm ơn bạn đã đồng hành cùng PFC." };
  if (q.error && ERRORS[q.error]) return { tone: "error", text: ERRORS[q.error] };
  if (q.reset === "1") return { tone: "success", text: "Đã đặt lại mật khẩu. Đăng nhập bằng mật khẩu mới (các thiết bị khác đã được đăng xuất)." };
  if (q.verified === "1") return { tone: "success", text: "Email đã được xác thực. Bạn có thể đăng nhập." };
  return null;
}

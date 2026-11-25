import "server-only";
import { one } from "@/platform/db/client";
import { ActionError } from "@/platform/errors";
import { isEnabled } from "@/platform/settings/service";
import type { Flag } from "@/platform/settings/defaults";

export const RESTRICTION_KINDS = {
  community: "Đăng bài, bình luận cộng đồng",
  messages: "Gửi tin nhắn",
  market_sell: "Đăng bán trên Marketplace",
  events_host: "Tổ chức sự kiện",
} as const;
export type RestrictionKind = keyof typeof RESTRICTION_KINDS;

/** Active restriction (not lifted, not expired), if any. */
export async function activeRestriction(memberId: string, kind: RestrictionKind): Promise<{ reason: string; until: string | null } | null> {
  return one<{ reason: string; until: string | null }>(
    "SELECT reason, until FROM member_restrictions WHERE member_id = ? AND kind = ? AND lifted_at IS NULL AND (until IS NULL OR until > ?) ORDER BY created_at DESC LIMIT 1",
    [memberId, kind, new Date().toISOString()],
  );
}

/** Throws when the member is restricted for this kind of action, or the feature is switched off. */
export async function assertAllowed(memberId: string, kind: RestrictionKind, flag?: Flag): Promise<void> {
  if (flag && !(await isEnabled(flag))) throw new ActionError("Tính năng này đang tạm tắt.");
  const r = await activeRestriction(memberId, kind);
  if (r) {
    const until = r.until ? ` đến ${new Date(r.until).toLocaleDateString("vi-VN", { timeZone: "Asia/Ho_Chi_Minh" })}` : "";
    throw new ActionError(`Tài khoản của bạn đang bị hạn chế ${RESTRICTION_KINDS[kind].toLowerCase()}${until}. Lý do: ${r.reason}`, "restricted");
  }
}

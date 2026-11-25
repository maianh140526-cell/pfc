"use server";

import { headers } from "next/headers";
import { revalidatePath } from "next/cache";
import { safeAction, type ActionResult } from "@/platform/action-result";
import { deviceLabel } from "@/platform/auth/device";
import { requireMemberForAction } from "@/platform/auth/session";
import { ActionError } from "@/platform/errors";
import { removeSubscription, saveSubscription, sendPush } from "./push";
import { markAllRead, setPref } from "./service";

export async function markAllReadAction(): Promise<ActionResult<number>> {
  return safeAction(async () => {
    const me = await requireMemberForAction();
    const n = await markAllRead(me.id);
    revalidatePath("/", "layout");
    return n;
  });
}

export async function setPrefAction(category: string, channel: string, enabled: boolean): Promise<ActionResult> {
  return safeAction(async () => {
    const me = await requireMemberForAction();
    await setPref(me.id, category, channel, enabled);
    return undefined;
  });
}

/** Stores this browser's push subscription (NOT-05). The endpoint must be a known push service. */
export async function subscribePushAction(sub: { endpoint?: unknown; keys?: { p256dh?: unknown; auth?: unknown } }): Promise<ActionResult> {
  return safeAction(async () => {
    const me = await requireMemberForAction();
    try {
      await saveSubscription(me.id, { endpoint: sub.endpoint, keys: sub.keys }, deviceLabel((await headers()).get("user-agent")));
    } catch {
      throw new ActionError("Trình duyệt trả về đăng ký thông báo không hợp lệ.");
    }
    return undefined;
  });
}

export async function unsubscribePushAction(endpoint: string): Promise<ActionResult> {
  return safeAction(async () => {
    const me = await requireMemberForAction();
    await removeSubscription(me.id, endpoint);
    return undefined;
  });
}

/** "Gửi thử" so members can check push works on this phone. */
export async function testPushAction(): Promise<ActionResult<number>> {
  return safeAction(async () => {
    const me = await requireMemberForAction();
    const n = await sendPush(me.id, { title: "PFC · Thông báo thử", body: "Thông báo đẩy đang hoạt động trên thiết bị này.", href: "/notifications" });
    if (n === 0) throw new ActionError("Chưa gửi được. Hãy bật thông báo trên thiết bị này trước.");
    return n;
  });
}

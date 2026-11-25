"use server";

import { revalidatePath } from "next/cache";
import { safeAction, type ActionResult } from "@/platform/action-result";
import { requireMemberForAction, toActor } from "@/platform/auth/session";
import * as pay from "./service";

async function act<T>(fn: (a: ReturnType<typeof toActor>) => Promise<T>): Promise<ActionResult<T>> {
  return safeAction(async () => {
    const me = await requireMemberForAction();
    const out = await fn(toActor(me));
    revalidatePath("/payments", "layout");
    revalidatePath("/market", "layout");
    revalidatePath("/events", "layout");
    return out;
  });
}

export const requestRefundAction = async (input: unknown) => act((a) => pay.requestRefund(a, input));
export const decideRefundAction = async (id: string, approve: boolean, note?: string) => act((a) => pay.decideRefund(a, id, approve, note));
export const markRefundedAction = async (id: string, ref: string) => act((a) => pay.markRefunded(a, id, ref));
export const createPayoutAction = async (payeeId: string) => act((a) => pay.createPayout(a, payeeId));
export const markPayoutPaidAction = async (id: string, note: string) => act((a) => pay.markPayoutPaid(a, id, note));

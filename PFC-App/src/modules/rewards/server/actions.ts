"use server";

import { revalidatePath } from "next/cache";
import { safeAction, type ActionResult } from "@/platform/action-result";
import { requireMemberForAction, toActor } from "@/platform/auth/session";
import * as rw from "./service";

async function act<T>(fn: (a: ReturnType<typeof toActor>) => Promise<T>): Promise<ActionResult<T>> {
  return safeAction(async () => {
    const me = await requireMemberForAction();
    const out = await fn(toActor(me));
    revalidatePath("/rewards", "layout");
    revalidatePath("/admin", "layout");
    return out;
  });
}

export const redeemAction = async (rewardId: string) => act((a) => rw.redeem(a, rewardId));
export const saveRewardAction = async (id: string | null, input: unknown) => act((a) => rw.saveReward(a, id, input));
export const decideRedemptionAction = async (id: string, fulfil: boolean, note: string) => act((a) => rw.decideRedemption(a, id, fulfil, note));
export const adjustPointsAction = async (memberId: string, delta: number, note: string) => act((a) => rw.adjustPoints(a, memberId, delta, note));

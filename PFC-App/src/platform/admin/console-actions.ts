"use server";

import { revalidatePath } from "next/cache";
import { safeAction, type ActionResult } from "@/platform/action-result";
import { requireMemberForAction, toActor } from "@/platform/auth/session";
import { saveMarket, saveRules, saveTiers, setFlag } from "@/platform/settings/service";
import * as c from "./console";

async function act<T>(fn: (a: ReturnType<typeof toActor>) => Promise<T>, ...paths: string[]): Promise<ActionResult<T>> {
  return safeAction(async () => {
    const me = await requireMemberForAction();
    const out = await fn(toActor(me));
    for (const p of paths.length ? paths : ["/admin"]) revalidatePath(p, "layout");
    return out;
  });
}

export const restrictAction = async (memberId: string, input: unknown) => act((a) => c.restrict(a, memberId, input));
export const liftRestrictionAction = async (id: string) => act((a) => c.liftRestriction(a, id));
export const setFlagAction = async (flag: string, on: boolean) => act((a) => setFlag(a, flag, on), "/");
export const saveRulesAction = async (input: unknown) => act((a) => saveRules(a, input), "/admin", "/rewards");
export const saveTiersAction = async (input: unknown) => act((a) => saveTiers(a, input), "/admin", "/rewards");
export const previewAudienceAction = async (audience: unknown) => act((a) => c.previewAudience(a, audience));
export const sendCampaignAction = async (input: unknown) => act((a) => c.sendCampaign(a, input));
export const createTicketAction = async (input: unknown) => act((a) => c.createTicket(a, input), "/more/support", "/admin");
export const replyTicketAction = async (id: string, body: string) => act((a) => c.replyTicket(a, id, body), "/more/support", "/admin");
export const closeTicketAction = async (id: string) => act((a) => c.closeTicket(a, id), "/more/support", "/admin");
export const saveMarketAction = async (input: unknown) => act((a) => saveMarket(a, input), "/admin", "/market");

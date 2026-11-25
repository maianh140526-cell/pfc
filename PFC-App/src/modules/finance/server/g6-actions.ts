"use server";

import { revalidatePath } from "next/cache";
import { safeAction, type ActionResult } from "@/platform/action-result";
import { requireMemberForAction, toActor } from "@/platform/auth/session";
import * as inv from "./invest";
import * as pl from "./places";

async function act<T>(fn: (a: ReturnType<typeof toActor>) => Promise<T>, path: string): Promise<ActionResult<T>> {
  return safeAction(async () => {
    const me = await requireMemberForAction();
    const out = await fn(toActor(me));
    revalidatePath(path, "layout");
    return out;
  });
}

// Investments: the member id always comes from the session (BR-009).
export const saveHoldingAction = async (id: string | null, input: unknown) => act((a) => inv.saveHolding(a.id, id, input), "/finance/invest");
export const updatePriceAction = async (id: string, price: unknown) => act((a) => inv.updatePrice(a.id, id, price), "/finance/invest");
export const deleteHoldingAction = async (id: string) => act((a) => inv.deleteHolding(a.id, id), "/finance/invest");

// Places (Ngon – Bổ – Rẻ).
export const savePlaceAction = async (id: string | null, input: unknown) => act((a) => pl.savePlace(a, id, input), "/finance/places");
export const reviewPlaceAction = async (id: string, input: unknown) => act((a) => pl.reviewPlace(a, id, input), "/finance/places");
export const deleteMyReviewAction = async (id: string) => act((a) => pl.deleteMyReview(a, id), "/finance/places");
export const toggleSavePlaceAction = async (id: string) => act((a) => pl.toggleSavePlace(a, id), "/finance/places");
export const setPlaceHiddenAction = async (id: string, hidden: boolean, reason?: string) => act((a) => pl.setPlaceHidden(a, id, hidden, reason), "/finance/places");
export const deletePlaceAction = async (id: string) => act((a) => pl.deletePlace(a, id), "/finance/places");

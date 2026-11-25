"use server";

import { revalidatePath } from "next/cache";
import { safeAction, type ActionResult } from "@/platform/action-result";
import { requireMemberForAction, toActor } from "@/platform/auth/session";
import { requestIp } from "@/platform/request-ip";
import type { EventAction } from "../domain/events";
import * as ev from "./service";

async function act<T>(fn: (a: ReturnType<typeof toActor>) => Promise<T>): Promise<ActionResult<T>> {
  return safeAction(async () => {
    const me = await requireMemberForAction();
    const out = await fn(toActor(me));
    revalidatePath("/events", "layout");
    return out;
  });
}

export const createEventAction = async (input: unknown) => act((a) => ev.createEvent(a, input));
export const updateEventAction = async (id: string, input: unknown) => act((a) => ev.updateEvent(a, id, input));
export const eventTransitionAction = async (id: string, action: EventAction, reason?: string) => act((a) => ev.eventTransition(a, id, action, reason));
export const toggleFavoriteAction = async (id: string) => act((a) => ev.toggleFavorite(a, id));
export const registerAction = async (id: string, input: unknown) => act(async (a) => ev.register(a, id, input, await requestIp()));
export const resumePaymentAction = async (registrationId: string) => act(async (a) => ev.resumePayment(a, registrationId, await requestIp()));
export const cancelRegistrationAction = async (registrationId: string) => act((a) => ev.cancelRegistration(a, registrationId));
export const checkInAction = async (id: string, code: string, collected = false) => act((a) => ev.checkIn(a, id, code, collected));

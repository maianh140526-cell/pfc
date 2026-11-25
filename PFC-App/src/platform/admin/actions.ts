"use server";

import { revalidatePath } from "next/cache";
import { safeAction, type ActionResult } from "@/platform/action-result";
import { requireMemberForAction, toActor } from "@/platform/auth/session";
import { setLocked, setRole } from "./service";

export async function setRoleAction(targetId: string, role: string, department: string | null): Promise<ActionResult> {
  return safeAction(async () => {
    const me = await requireMemberForAction();
    await setRole(toActor(me), String(targetId), role, department);
    revalidatePath("/more/admin");
    return undefined;
  });
}

export async function setLockedAction(targetId: string, locked: boolean): Promise<ActionResult> {
  return safeAction(async () => {
    const me = await requireMemberForAction();
    await setLocked(toActor(me), String(targetId), Boolean(locked));
    revalidatePath("/more/admin");
    return undefined;
  });
}

"use server";

import { revalidatePath } from "next/cache";
import { safeAction, type ActionResult } from "@/platform/action-result";
import { requireMemberForAction, toActor } from "@/platform/auth/session";
import * as feed from "./service";

async function act<T>(fn: (actor: ReturnType<typeof toActor>) => Promise<T>): Promise<ActionResult<T>> {
  return safeAction(async () => {
    const me = await requireMemberForAction();
    const out = await fn(toActor(me));
    revalidatePath("/opportunities/sources", "layout");
    return out;
  });
}

export const createPostAction = async (input: unknown) => act((a) => feed.createPost(a, input));
export const updatePostAction = async (id: string, input: unknown) => act((a) => feed.updatePost(a, id, input));
export const setPostStateAction = async (id: string, state: "open" | "closed") => act((a) => feed.setPostState(a, id, state === "closed" ? "closed" : "open"));
export const deletePostAction = async (id: string) => act((a) => feed.deletePost(a, id));

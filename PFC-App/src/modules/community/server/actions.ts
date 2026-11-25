"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { safeAction, type ActionResult } from "@/platform/action-result";
import { requireMemberForAction, toActor } from "@/platform/auth/session";
import * as dm from "./messages";
import * as com from "./service";

async function act<T>(fn: (a: ReturnType<typeof toActor>) => Promise<T>): Promise<ActionResult<T>> {
  return safeAction(async () => {
    const me = await requireMemberForAction();
    const out = await fn(toActor(me));
    revalidatePath("/community", "layout");
    return out;
  });
}

export const createGroupAction = async (input: unknown) => act((a) => com.createGroup(a, input));
export const updateGroupAction = async (id: string, input: unknown) => act((a) => com.updateGroup(a, id, input));
export const joinGroupAction = async (id: string) => act((a) => com.joinGroup(a, id));
export const leaveGroupAction = async (id: string) => act((a) => com.leaveGroup(a, id));
export const decideJoinAction = async (id: string, memberId: string, accept: boolean) => act((a) => com.decideJoin(a, id, memberId, accept));
export const removeFromGroupAction = async (id: string, memberId: string) => act((a) => com.removeFromGroup(a, id, memberId));
export const setGroupRoleAction = async (id: string, memberId: string, role: "moderator" | "member") => act((a) => com.setGroupRole(a, id, memberId, role));
export const archiveGroupAction = async (id: string, reason?: string) => act((a) => com.archiveGroup(a, id, reason));

export const createPostAction = async (input: unknown) => act((a) => com.createPost(a, input));
export const updatePostAction = async (id: string, input: unknown) => act((a) => com.updatePost(a, id, input));
export const deletePostAction = async (id: string) => act((a) => com.deletePost(a, id));
export const setPostHiddenAction = async (id: string, hidden: boolean, reason?: string) => act((a) => com.setPostHidden(a, id, hidden, reason));
export const toggleLikeAction = async (id: string) => act((a) => com.toggleLike(a, id));
export const toggleSaveAction = async (id: string) => act((a) => com.toggleSave(a, id));
export const voteAction = async (id: string, optionId: string) => act((a) => com.vote(a, id, optionId));
export const addCommentAction = async (id: string, body: string, parentId?: string | null) => act((a) => com.addComment(a, id, body, parentId));
export const deleteCommentAction = async (id: string) => act((a) => com.deleteComment(a, id));
export const setCommentHiddenAction = async (id: string, hidden: boolean) => act((a) => com.setCommentHidden(a, id, hidden));

export const toggleFollowAction = async (memberId: string) => act((a) => com.toggleFollow(a, memberId));
export const toggleBlockAction = async (memberId: string) => act((a) => com.toggleBlock(a, memberId));
export const reportAction = async (input: unknown) => act((a) => com.report(a, input));
export const decideReportAction = async (id: string, decision: "hide" | "dismiss", note?: string) => act((a) => com.decideReport(a, id, decision, note));

/** Opens the conversation with a member (privacy + blocks checked) and goes there. */
export async function messageMemberAction(memberId: string): Promise<ActionResult> {
  const res = await safeAction(async () => {
    const me = await requireMemberForAction();
    return dm.startConversation(toActor(me), memberId);
  });
  if (res.ok) redirect(`/messages/${res.data}`);
  return res.ok ? { ok: true, data: undefined } : res;
}
export const sendMessageAction = async (conversationId: string, body: string) =>
  safeAction(async () => dm.sendMessage(toActor(await requireMemberForAction()), conversationId, body));
export const deleteMessageAction = async (messageId: string) => safeAction(async () => dm.deleteMessage(toActor(await requireMemberForAction()), messageId));

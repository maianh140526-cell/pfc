"use server";

import { revalidatePath } from "next/cache";
import { safeAction, type ActionResult } from "@/platform/action-result";
import { requireMemberForAction, toActor } from "@/platform/auth/session";
import type { ProjectAction } from "../domain/projects";
import * as prj from "./service";

async function act<T>(fn: (actor: ReturnType<typeof toActor>) => Promise<T>): Promise<ActionResult<T>> {
  return safeAction(async () => {
    const me = await requireMemberForAction();
    const out = await fn(toActor(me));
    revalidatePath("/projects", "layout");
    return out;
  });
}

export const createProjectAction = async (input: unknown) => act((a) => prj.createProject(a, input));
export const updateProjectAction = async (id: string, input: unknown) => act((a) => prj.updateProject(a, id, input));
export const projectTransitionAction = async (id: string, action: ProjectAction, reason?: string) => act((a) => prj.projectTransition(a, id, action, reason));
export const deleteProjectAction = async (id: string) => act((a) => prj.deleteProject(a, id));

export const requestToJoinAction = async (id: string, input: unknown) => act((a) => prj.requestToJoin(a, id, input));
export const cancelRequestAction = async (id: string) => act((a) => prj.cancelRequest(a, id));
export const decideRequestAction = async (id: string, memberId: string, accept: boolean) => act((a) => prj.decideRequest(a, id, memberId, accept));
export const inviteMemberAction = async (id: string, input: unknown) => act((a) => prj.inviteMember(a, id, input));
export const respondInviteAction = async (id: string, accept: boolean) => act((a) => prj.respondInvite(a, id, accept));
export const removeMemberAction = async (id: string, memberId: string) => act((a) => prj.removeMember(a, id, memberId));
export const leaveProjectAction = async (id: string) => act((a) => prj.leaveProject(a, id));
export const setMemberRoleAction = async (id: string, memberId: string, role: "lead" | "member") => act((a) => prj.setMemberRole(a, id, memberId, role));

export const createTaskAction = async (id: string, input: unknown) => act((a) => prj.createTask(a, id, input));
export const updateTaskAction = async (taskId: string, input: unknown) => act((a) => prj.updateTask(a, taskId, input));
export const deleteTaskAction = async (taskId: string) => act((a) => prj.deleteTask(a, taskId));
export const postUpdateAction = async (id: string, input: unknown) => act((a) => prj.postUpdate(a, id, input));
export const deleteUpdateAction = async (updateId: string) => act((a) => prj.deleteUpdate(a, updateId));
export const addLinkAction = async (id: string, input: unknown) => act((a) => prj.addLink(a, id, input));
export const removeLinkAction = async (linkId: string) => act((a) => prj.removeLink(a, linkId));

export const giveFeedbackAction = async (id: string, input: unknown) => act((a) => prj.giveFeedback(a, id, input));
export const setFeedbackHiddenAction = async (feedbackId: string, hidden: boolean) => act((a) => prj.setFeedbackHidden(a, feedbackId, hidden));

export const saveCollabProfileAction = async (input: unknown) =>
  safeAction(async () => {
    const me = await requireMemberForAction();
    await (await import("./collab")).saveCollabProfile(toActor(me), input);
    revalidatePath("/projects/collab", "layout");
  });

"use server";

import { revalidatePath } from "next/cache";
import { safeAction, type ActionResult } from "@/platform/action-result";
import { requireMemberForAction, toActor } from "@/platform/auth/session";
import type { WorkflowAction } from "@/platform/workflow";
import * as edu from "./service";

/** Thin wrappers: authenticate → call the use-case (which enforces permissions) → revalidate. */
async function act<T>(fn: (actor: ReturnType<typeof toActor>) => Promise<T>): Promise<ActionResult<T>> {
  return safeAction(async () => {
    const me = await requireMemberForAction();
    const out = await fn(toActor(me));
    revalidatePath("/learn", "layout");
    return out;
  });
}

export const createCourseAction = async (input: unknown) => act((a) => edu.createCourse(a, input));
export const updateCourseAction = async (id: string, input: unknown) => act((a) => edu.updateCourse(a, id, input));
export const addLessonAction = async (courseId: string, input: unknown) => act((a) => edu.addLesson(a, courseId, input));
export const updateLessonAction = async (lessonId: string, input: unknown) => act((a) => edu.updateLesson(a, lessonId, input));
export const deleteLessonAction = async (lessonId: string) => act((a) => edu.deleteLesson(a, lessonId));
export const moveLessonAction = async (lessonId: string, dir: -1 | 1) => act((a) => edu.moveLesson(a, lessonId, dir === -1 ? -1 : 1));
export const transitionAction = async (kind: "course" | "quiz" | "resource", id: string, action: WorkflowAction, reason?: string) =>
  act((a) => edu.transition(a, kind, id, action, reason));
export const deleteContentAction = async (kind: "course" | "quiz" | "resource", id: string) => act((a) => edu.deleteContent(a, kind, id));
export const enrollAction = async (courseId: string) => act((a) => edu.enroll(a, courseId));
export const completeLessonAction = async (lessonId: string) => act((a) => edu.completeLesson(a, lessonId));
export const createQuizAction = async (input: unknown) => act((a) => edu.createQuiz(a, input));
export const updateQuizAction = async (id: string, input: unknown) => act((a) => edu.updateQuiz(a, id, input));
export const saveQuestionAction = async (quizId: string, questionId: string | null, input: unknown) => act((a) => edu.saveQuestion(a, quizId, questionId, input));
export const deleteQuestionAction = async (quizId: string, questionId: string) => act((a) => edu.deleteQuestion(a, quizId, questionId));
export const startAttemptAction = async (quizId: string) => act((a) => edu.startAttempt(a, quizId));
export const submitAttemptAction = async (quizId: string, answers: unknown) => act((a) => edu.submitAttempt(a, quizId, answers));
export const saveResourceAction = async (id: string | null, input: unknown) => act((a) => edu.saveResource(a, id, input));
export const createThreadAction = async (input: unknown) => act((a) => edu.createThread(a, input));
export const replyAction = async (threadId: string, body: string, parentId?: string | null) => act((a) => edu.reply(a, threadId, body, parentId));
export const toggleLikeAction = async (threadId: string) => act((a) => edu.toggleLike(a, threadId));
export const moderateThreadAction = async (threadId: string, change: { hidden?: boolean; locked?: boolean }) => act((a) => edu.moderateThread(a, threadId, change));
export const moderateReplyAction = async (replyId: string, hidden: boolean) => act((a) => edu.moderateReply(a, replyId, hidden));
export const deleteOwnPostAction = async (kind: "thread" | "reply", id: string) => act((a) => edu.deleteOwnPost(a, kind, id));

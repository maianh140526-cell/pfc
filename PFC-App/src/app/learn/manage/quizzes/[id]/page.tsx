import { notFound } from "next/navigation";
import { requireMember, toActor } from "@/platform/auth/session";
import { getQuizForEditing } from "@/modules/education/server/service";
import { AppHeader } from "@/ui";
import { QuizEditor } from "./QuizEditor";

export const dynamic = "force-dynamic";

/** EDU-A04 Question Bank Management + EDU-A05 Quiz Management. */
export default async function EditQuizPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const me = await requireMember(`/learn/manage/quizzes/${id}`);
  const q = await getQuizForEditing(toActor(me), id);
  if (!q) notFound();
  return (
    <>
      <AppHeader back backFallback="/learn/manage" title="Quản lý bài kiểm tra" />
      <QuizEditor quiz={q} />
    </>
  );
}

import { requireMember, toActor } from "@/platform/auth/session";
import { linkableQuizzes } from "@/modules/education/server/service";
import { AppHeader } from "@/ui";
import { ResourceForm } from "../ResourceForm";

export const metadata = { title: "Tài liệu mới" };

export default async function NewResourcePage() {
  const me = await requireMember("/learn/manage/resources/new");
  return (
    <>
      <AppHeader back backFallback="/learn/manage" title="Tài liệu mới" />
      <ResourceForm quizzes={await linkableQuizzes(toActor(me))} />
    </>
  );
}

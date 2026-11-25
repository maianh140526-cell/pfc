import { notFound } from "next/navigation";
import { requireMember, toActor } from "@/platform/auth/session";
import { getResource, linkableQuizzes } from "@/modules/education/server/service";
import { AppHeader } from "@/ui";
import { ResourceForm } from "../ResourceForm";

export const dynamic = "force-dynamic";

export default async function EditResourcePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const me = await requireMember(`/learn/manage/resources/${id}`);
  const r = await getResource(toActor(me), id);
  if (!r) notFound();
  return (
    <>
      <AppHeader back backFallback="/learn/manage" title="Quản lý tài liệu" />
      <ResourceForm initial={r} quizzes={await linkableQuizzes(toActor(me))} />
    </>
  );
}

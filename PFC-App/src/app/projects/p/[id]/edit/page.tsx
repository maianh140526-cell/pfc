import { notFound } from "next/navigation";
import { requireMember, toActor } from "@/platform/auth/session";
import { getProject } from "@/modules/projects/server/service";
import { ProjectForm } from "@/modules/projects/ui/ProjectForm";
import { AppHeader } from "@/ui";

export const metadata = { title: "Sửa dự án" };
export const dynamic = "force-dynamic";

export default async function EditProjectPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const me = await requireMember(`/projects/p/${id}/edit`);
  const p = await getProject(toActor(me), id);
  if (!p || !p.canEdit) notFound();
  return (
    <>
      <AppHeader back backFallback={`/projects/p/${id}`} title="Sửa dự án" />
      <ProjectForm id={id} initial={{ title: p.title, summary: p.summary, description: p.description, category: p.category, skills: p.skills.join(", "), recruiting: p.recruiting }} />
    </>
  );
}

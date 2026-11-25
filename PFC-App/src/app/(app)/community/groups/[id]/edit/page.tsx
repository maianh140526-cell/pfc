import { notFound } from "next/navigation";
import { requireMember, toActor } from "@/platform/auth/session";
import { getGroup } from "@/modules/community/server/service";
import { GroupForm } from "@/modules/community/ui/GroupForm";
import { AppHeader } from "@/ui";

export const metadata = { title: "Sửa nhóm" };
export const dynamic = "force-dynamic";

export default async function EditGroupPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const me = await requireMember(`/community/groups/${id}/edit`);
  const g = await getGroup(toActor(me), id);
  if (!g || !g.caps.editGroup || g.archived) notFound();
  return (
    <>
      <AppHeader back backFallback={`/community/groups/${id}`} title="Sửa nhóm" />
      <GroupForm id={id} initial={{ name: g.name, description: g.description, topic: g.topic, visibility: g.visibility, coverUrl: g.coverUrl }} />
    </>
  );
}

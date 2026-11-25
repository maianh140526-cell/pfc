import { notFound } from "next/navigation";
import { can } from "@/platform/roles";
import { getExternal } from "@/modules/oppfeed/server/service";
import { AppHeader } from "@/ui";
import { requirePoster } from "../../require-poster";
import { PostForm } from "../../PostForm";

export const dynamic = "force-dynamic";

export default async function EditPostPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const actor = await requirePoster(`/opportunities/sources/${id}/edit`);
  const o = await getExternal(id);
  if (!o || o.source !== "pfc" || (o.authorId !== actor.id && !can(actor, "admin.dashboard"))) notFound();
  return (
    <>
      <AppHeader back backFallback="/opportunities/sources/manage" title="Sửa cơ hội" />
      <PostForm
        existing={{
          id: o.id,
          closed: o.rawState === "closed",
          type: o.type,
          title: o.title,
          organization: o.organization,
          location: o.location,
          summary: o.summary,
          url: o.url,
          deadlineAt: o.deadlineAt ? new Date(o.deadlineAt).toLocaleDateString("sv-SE", { timeZone: "Asia/Ho_Chi_Minh" }) : "",
          images: o.imageUrl ? [o.imageUrl] : [],
        }}
      />
    </>
  );
}

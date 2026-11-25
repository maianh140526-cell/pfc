import { notFound } from "next/navigation";
import { requireMember, toActor } from "@/platform/auth/session";
import { getPost } from "@/modules/community/server/service";
import { PostForm } from "@/modules/community/ui/PostForm";
import { AppHeader } from "@/ui";

export const metadata = { title: "Sửa bài viết" };
export const dynamic = "force-dynamic";

/** COM-05 Edit Post. */
export default async function EditPostPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const me = await requireMember(`/community/posts/${id}/edit`);
  const p = await getPost(toActor(me), id);
  if (!p || !p.canEdit) notFound();
  return (
    <>
      <AppHeader back backFallback={`/community/posts/${id}`} title="Sửa bài viết" />
      <PostForm initial={{ id: p.id, title: p.title, body: p.body, topic: p.topic, images: p.images, allowComments: p.allowComments }} />
    </>
  );
}

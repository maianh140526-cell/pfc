import { requireMember, toActor } from "@/platform/auth/session";
import { listGroups } from "@/modules/community/server/service";
import { AppHeader } from "@/ui";
import { PostForm } from "@/modules/community/ui/PostForm";

export const metadata = { title: "Tạo bài viết" };
export const dynamic = "force-dynamic";

/** COM-04 Create Post (mockup 76). */
export default async function NewPostPage({ searchParams }: { searchParams: Promise<{ group?: string }> }) {
  const { group } = await searchParams;
  const me = await requireMember("/community/posts/new");
  const groups = await listGroups(toActor(me), { mine: true });
  return (
    <>
      <AppHeader back backFallback="/community" title="Tạo bài viết" />
      <PostForm groups={groups.map((g) => ({ id: g.id, name: g.name }))} defaultGroup={groups.some((g) => g.id === group) ? group : undefined} />
    </>
  );
}

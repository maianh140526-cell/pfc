import { AppHeader } from "@/ui";
import { requirePoster } from "../require-poster";
import { PostForm } from "../PostForm";

export const metadata = { title: "Đăng cơ hội" };
export const dynamic = "force-dynamic";

export default async function NewPostPage() {
  await requirePoster("/opportunities/sources/new");
  return (
    <>
      <AppHeader back backFallback="/opportunities/sources/manage" title="Đăng cơ hội" />
      <PostForm />
    </>
  );
}

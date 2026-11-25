import { Megaphone } from "lucide-react";
import { myPosts } from "@/modules/oppfeed/server/service";
import { AppHeader, EmptyState, ButtonLink } from "@/ui";
import { ExtCard } from "@/modules/oppfeed/ui/ExtCard";
import { requirePoster } from "../require-poster";

export const metadata = { title: "Tin tôi đã đăng" };
export const dynamic = "force-dynamic";

/** Leaders: the postings they published, with a shortcut to create a new one. */
export default async function ManagePostsPage() {
  const actor = await requirePoster("/opportunities/sources/manage");
  const items = await myPosts(actor);
  return (
    <>
      <AppHeader back backFallback="/opportunities/sources" title="Tin tôi đã đăng" />
      <div className="px-4">
        <ButtonLink href="/opportunities/sources/new" block>
          Đăng cơ hội mới
        </ButtonLink>
      </div>
      {items.length === 0 ? (
        <EmptyState icon={Megaphone} title="Bạn chưa đăng tin nào" description="Đăng việc làm, thực tập, học bổng hoặc cuộc thi cho thành viên PFC." />
      ) : (
        <ul className="space-y-3 px-4 pt-4">
          {items.map((o) => (
            <li key={o.id} className="space-y-1">
              <ExtCard o={o} />
              <ButtonLink href={`/opportunities/sources/${o.id}/edit`} variant="secondary" block>
                Sửa / đóng tin
              </ButtonLink>
            </li>
          ))}
        </ul>
      )}
    </>
  );
}

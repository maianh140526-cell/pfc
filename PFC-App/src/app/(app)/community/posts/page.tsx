import { Newspaper } from "lucide-react";
import { currentMember, toActor } from "@/platform/auth/session";
import { TOPICS } from "@/modules/community/domain/rules";
import { feed } from "@/modules/community/server/service";
import { PostCard } from "@/modules/community/ui/PostCard";
import { AppHeader, EmptyState, FabLink } from "@/ui";
import { FilterChips } from "@/ui/FilterChips";
import { SearchBox } from "@/ui/SearchBox";

export const metadata = { title: "Bài viết" };
export const dynamic = "force-dynamic";

const TABS = { latest: "Mới nhất", following: "Đang theo dõi", top: "Nổi bật", saved: "Đã lưu", mine: "Của tôi" } as const;
type Tab = keyof typeof TABS;

/** COM-02 Community Feed / Forum (mockup 74). */
export default async function PostsPage({ searchParams }: { searchParams: Promise<{ tab?: string; topic?: string; tag?: string; q?: string }> }) {
  const sp = await searchParams;
  const me = await currentMember();
  const tabs = (Object.keys(TABS) as Tab[]).filter((t) => me || t === "latest" || t === "top");
  const tab: Tab = sp.tab && tabs.includes(sp.tab as Tab) ? (sp.tab as Tab) : "latest";
  const posts = await feed(me ? toActor(me) : null, { tab, topic: sp.topic, tag: sp.tag, q: sp.q?.slice(0, 80), limit: 50 });
  const qs = (patch: Record<string, string | undefined>) => {
    const p = new URLSearchParams();
    for (const [k, v] of Object.entries({ tab: sp.tab, topic: sp.topic, tag: sp.tag, q: sp.q, ...patch })) if (v) p.set(k, v);
    return `/community/posts?${p.toString()}`;
  };
  return (
    <>
      <AppHeader back backFallback="/community" title={sp.tag ? `#${sp.tag}` : "Bài viết"} />
      <div className="space-y-3 px-4">
        <SearchBox placeholder="Tìm trong bài viết…" />
        <FilterChips label="Danh sách" value={tab} hrefFor={(t) => qs({ tab: t === "latest" ? undefined : t })} options={tabs.map((t) => ({ value: t, label: TABS[t] }))} />
        <FilterChips
          label="Chủ đề"
          value={sp.topic && sp.topic in TOPICS ? sp.topic : ""}
          hrefFor={(t) => qs({ topic: t || undefined })}
          options={[{ value: "", label: "Mọi chủ đề" }, ...Object.entries(TOPICS).map(([value, label]) => ({ value, label }))]}
        />
      </div>
      {posts.length === 0 ? (
        <EmptyState icon={Newspaper} title="Không có bài viết" description={tab === "following" ? "Theo dõi thành viên hoặc tham gia nhóm để thấy bài của họ ở đây." : "Thử chủ đề hoặc từ khóa khác."} />
      ) : (
        <ul className="space-y-3 px-4 pt-3">
          {posts.map((p) => (
            <li key={p.id}>
              <PostCard p={p} signedIn={!!me} />
            </li>
          ))}
        </ul>
      )}
      {me && <FabLink href="/community/posts/new" label="Viết bài" />}
    </>
  );
}

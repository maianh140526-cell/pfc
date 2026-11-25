import Link from "next/link";
import { Users } from "lucide-react";
import { requireMember, toActor } from "@/platform/auth/session";
import { memberDirectory } from "@/modules/community/server/service";
import { AppHeader, EmptyState } from "@/ui";
import { Avatar } from "@/ui/Avatar";
import { SearchBox } from "@/ui/SearchBox";
import { FollowButton } from "../posts/[id]/PostClient";

export const metadata = { title: "Thành viên" };
export const dynamic = "force-dynamic";

/** COM-09 Member Directory (members who allow being listed). */
export default async function MembersPage({ searchParams }: { searchParams: Promise<{ q?: string }> }) {
  const { q } = await searchParams;
  const me = await requireMember("/community/members");
  const list = await memberDirectory(toActor(me), q?.slice(0, 60) ?? "");
  return (
    <>
      <AppHeader back backFallback="/community" title="Thành viên" />
      <div className="px-4">
        <SearchBox placeholder="Tìm thành viên…" />
      </div>
      {list.length === 0 ? (
        <EmptyState icon={Users} title="Không tìm thấy thành viên" />
      ) : (
        <ul className="divide-y divide-line px-4 pt-2">
          {list.map((m) => (
            <li key={m.id} className="flex items-center gap-3 py-3">
              <Link href={`/members/${m.id}`} className="flex min-w-0 flex-1 items-center gap-3">
                <Avatar name={m.name} url={m.avatarUrl} size={44} />
                <span className="min-w-0">
                  <span className="block truncate text-[15px] font-semibold text-ink">{m.name}</span>
                  <span className="block truncate text-[12px] text-muted">{m.bio || `${m.followers} người theo dõi`}</span>
                </span>
              </Link>
              <FollowButton memberId={m.id} following={m.isFollowing} />
            </li>
          ))}
        </ul>
      )}
    </>
  );
}

import Link from "next/link";
import { Lock, Plus, UsersRound } from "lucide-react";
import { currentMember, toActor } from "@/platform/auth/session";
import { TOPICS } from "@/modules/community/domain/rules";
import { listGroups } from "@/modules/community/server/service";
import { AppHeader, Badge, EmptyState } from "@/ui";
import { FilterChips } from "@/ui/FilterChips";
import { SearchBox } from "@/ui/SearchBox";

export const metadata = { title: "Nhóm" };
export const dynamic = "force-dynamic";

/** COM-11 Club/Group Directory · COM-22 My Communities (mockup 77). */
export default async function GroupsPage({ searchParams }: { searchParams: Promise<{ tab?: string; q?: string }> }) {
  const { tab, q } = await searchParams;
  const me = await currentMember();
  const mine = tab === "mine" && !!me;
  const groups = await listGroups(me ? toActor(me) : null, { q: q?.slice(0, 60), mine });
  return (
    <>
      <AppHeader
        back
        backFallback="/community"
        title="Nhóm & Câu lạc bộ"
        actions={
          me ? (
            <Link href="/community/groups/new" aria-label="Tạo nhóm" className="grid size-11 place-items-center rounded-full text-ink active:bg-surface-2">
              <Plus size={22} />
            </Link>
          ) : undefined
        }
      />
      <div className="space-y-3 px-4">
        <SearchBox placeholder="Tìm nhóm…" />
        {me && (
          <FilterChips
            label="Danh sách nhóm"
            value={mine ? "mine" : "all"}
            hrefFor={(t) => (t === "mine" ? "/community/groups?tab=mine" : "/community/groups")}
            options={[
              { value: "all", label: "Khám phá" },
              { value: "mine", label: "Đã tham gia" },
            ]}
          />
        )}
      </div>
      <ul className="space-y-3 px-4 pt-3">
        <li>
          <Link href="/club" className="pressable flex items-center gap-3 rounded-[var(--radius-card)] border border-primary bg-primary-soft p-4">
            <span className="grid size-12 shrink-0 place-items-center rounded-2xl bg-primary text-on-primary">
              <UsersRound size={24} />
            </span>
            <span className="min-w-0 flex-1">
              <span className="block text-[15px] font-bold text-ink">Câu lạc bộ PFC</span>
              <span className="block text-[12px] text-muted">CLB chính thức: thành viên, công việc, hoạt động</span>
            </span>
          </Link>
        </li>
        {groups.length === 0 ? (
          <li>
            <EmptyState icon={UsersRound} title={mine ? "Bạn chưa tham gia nhóm nào" : "Chưa có nhóm"} description="Tạo nhóm theo sở thích: đầu tư, tiết kiệm, nghề nghiệp…" />
          </li>
        ) : (
          groups.map((g) => (
            <li key={g.id}>
              <Link href={`/community/groups/${g.id}`} className="pressable flex items-center gap-3 rounded-[var(--radius-card)] border border-line bg-surface p-4">
                {g.coverUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element -- server-processed upload
                  <img src={g.coverUrl} alt="" className="size-12 shrink-0 rounded-2xl object-cover" />
                ) : (
                  <span className="grid size-12 shrink-0 place-items-center rounded-2xl bg-primary-soft text-[18px] font-bold text-primary">{g.name.slice(0, 1).toUpperCase()}</span>
                )}
                <span className="min-w-0 flex-1">
                  <span className="flex items-center gap-1 truncate text-[15px] font-bold text-ink">
                    {g.visibility === "private" && <Lock size={13} className="shrink-0 text-muted" />} {g.name}
                  </span>
                  <span className="block text-[12px] text-muted">
                    {g.members} thành viên · {TOPICS[g.topic]}
                  </span>
                  {g.description && <span className="line-clamp-1 block text-[12px] text-ink-2">{g.description}</span>}
                </span>
                {g.myStatus === "active" ? <Badge tone="income">Đã tham gia</Badge> : g.myStatus === "requested" ? <Badge tone="warning">Chờ duyệt</Badge> : null}
              </Link>
            </li>
          ))
        )}
      </ul>
    </>
  );
}

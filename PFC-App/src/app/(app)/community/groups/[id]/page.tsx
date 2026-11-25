import Link from "next/link";
import { notFound } from "next/navigation";
import { CalendarDays, Globe, Lock, Pencil, Users } from "lucide-react";
import { currentMember, toActor } from "@/platform/auth/session";
import { GROUP_ROLE_LABEL, TOPICS } from "@/modules/community/domain/rules";
import { feed, getGroup, groupMembers } from "@/modules/community/server/service";
import { PostCard } from "@/modules/community/ui/PostCard";
import { AppHeader, Badge, EmptyState, FabLink, Section } from "@/ui";
import { Avatar } from "@/ui/Avatar";
import { FilterChips } from "@/ui/FilterChips";
import { ArchiveGroup, JoinGroup, MemberRow, PendingRequests } from "./GroupClient";

export const dynamic = "force-dynamic";

/** COM-12 Group Detail · COM-15 Members · COM-16 Group Feed (mockup 78). */
export default async function GroupPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ tab?: string }> }) {
  const { id } = await params;
  const { tab } = await searchParams;
  const me = await currentMember();
  const actor = me ? toActor(me) : null;
  const g = await getGroup(actor, id);
  if (!g) notFound();
  const current = tab === "posts" || tab === "members" ? tab : "about";
  const [posts, members] = await Promise.all([
    current === "posts" && g.caps.viewContent ? feed(actor, { groupId: id, limit: 50 }) : Promise.resolve([]),
    current === "members" && g.caps.viewContent ? groupMembers(actor, id) : Promise.resolve([]),
  ]);
  return (
    <>
      <AppHeader
        back
        backFallback="/community/groups"
        title={g.name}
        actions={
          g.caps.editGroup && !g.archived ? (
            <Link href={`/community/groups/${id}/edit`} aria-label="Sửa nhóm" className="grid size-11 place-items-center rounded-full text-ink active:bg-surface-2">
              <Pencil size={20} />
            </Link>
          ) : undefined
        }
      />
      {g.coverUrl ? (
        // eslint-disable-next-line @next/next/no-img-element -- server-processed upload
        <img src={g.coverUrl} alt="" className="mx-4 h-36 w-[calc(100%-2rem)] rounded-[var(--radius-card)] object-cover" />
      ) : (
        <div className="mx-4 grid h-28 place-items-center rounded-[var(--radius-card)] bg-primary text-[34px] font-extrabold text-on-primary">{g.name.slice(0, 1).toUpperCase()}</div>
      )}
      <div className="px-4 pt-3">
        <h1 className="text-[20px] font-extrabold text-ink">{g.name}</h1>
        <p className="flex items-center gap-1 text-[13px] text-muted">
          <Users size={14} /> {g.members} thành viên · {g.visibility === "private" ? "Riêng tư" : "Công khai"}
        </p>
        {g.archived && <p className="mt-2 rounded-2xl bg-warning-soft p-3 text-[13px] text-ink-2">Nhóm đã được lưu trữ.</p>}
        {me && !g.archived && (
          <div className="mt-3">
            <JoinGroup id={id} myStatus={g.myStatus} myRole={g.myRole} visibility={g.visibility} />
          </div>
        )}
      </div>
      <div className="px-4 pt-3">
        <FilterChips
          label="Mục"
          value={current}
          hrefFor={(t) => (t === "about" ? `/community/groups/${id}` : `/community/groups/${id}?tab=${t}`)}
          options={[
            { value: "about", label: "Giới thiệu" },
            { value: "posts", label: "Bài viết" },
            { value: "members", label: "Thành viên" },
          ]}
        />
      </div>
      {current === "about" && (
        <>
          <Section title="Giới thiệu">
            <ul className="space-y-2 text-[14px] text-ink-2">
              <li className="flex gap-2">{g.visibility === "private" ? <Lock size={18} /> : <Globe size={18} />} {g.visibility === "private" ? "Riêng tư — chỉ thành viên xem bài viết" : "Công khai — ai cũng xem được bài viết"}</li>
              <li className="flex gap-2">
                <Users size={18} /> {g.members} thành viên · {TOPICS[g.topic]}
              </li>
              <li className="flex gap-2">
                <CalendarDays size={18} /> Thành lập {new Date(g.createdAt).toLocaleDateString("vi-VN")}
              </li>
            </ul>
            {g.description && <p className="mt-3 text-[14px] leading-relaxed whitespace-pre-line text-ink-2">{g.description}</p>}
          </Section>
          {g.pending.length > 0 && (
            <Section title={`Chờ duyệt (${g.pending.length})`}>
              <PendingRequests groupId={id} pending={g.pending} />
            </Section>
          )}
          {me && !g.archived && (g.myRole === "owner" || g.caps.moderate) && (
            <Section>
              <ArchiveGroup id={id} owner={g.myRole === "owner"} />
            </Section>
          )}
        </>
      )}
      {current === "posts" &&
        (!g.caps.viewContent ? (
          <EmptyState icon={Lock} title="Nhóm riêng tư" description="Tham gia nhóm để xem bài viết." />
        ) : posts.length === 0 ? (
          <EmptyState icon={Users} title="Chưa có bài viết trong nhóm" />
        ) : (
          <ul className="space-y-3 px-4 pt-3">
            {posts.map((p) => (
              <li key={p.id}>
                <PostCard p={p} signedIn={!!me} />
              </li>
            ))}
          </ul>
        ))}
      {current === "members" &&
        (!g.caps.viewContent ? (
          <EmptyState icon={Lock} title="Nhóm riêng tư" description="Tham gia nhóm để xem thành viên." />
        ) : (
          <Section>
            <ul className="divide-y divide-line overflow-hidden rounded-[var(--radius-card)] border border-line bg-surface">
              {members.map((m) => (
                <li key={m.memberId} className="flex items-center gap-3 px-4 py-3">
                  <Link href={`/members/${m.memberId}`} className="flex min-w-0 flex-1 items-center gap-3">
                    <Avatar name={m.name} url={m.avatarUrl} size={40} />
                    <span className="truncate text-[15px] font-semibold text-ink">{m.name}</span>
                  </Link>
                  <Badge tone={m.role === "owner" ? "primary" : "muted"}>{GROUP_ROLE_LABEL[m.role]}</Badge>
                  {g.myRole === "owner" && m.role !== "owner" && <MemberRow groupId={id} memberId={m.memberId} name={m.name} role={m.role} />}
                </li>
              ))}
            </ul>
            {g.myRole !== "owner" && <p className="mt-2 text-[12px] text-muted">Chỉ chủ nhóm được loại thành viên hoặc đổi vai trò.</p>}
          </Section>
        ))}
      {g.caps.post && !g.archived && <FabLink href={`/community/posts/new?group=${id}`} label="Đăng bài trong nhóm" />}
    </>
  );
}

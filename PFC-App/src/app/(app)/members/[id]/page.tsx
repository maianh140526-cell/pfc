import Link from "next/link";
import { notFound } from "next/navigation";
import { requireMember, toActor } from "@/platform/auth/session";
import { all, one } from "@/platform/db/client";
import { DEPARTMENT_LABEL, ROLE_LABEL, isDepartment, isRole } from "@/platform/roles";
import { feed, socialStats } from "@/modules/community/server/service";
import { PostCard } from "@/modules/community/ui/PostCard";
import { AppHeader, Badge, ButtonLink, Section } from "@/ui";
import { Avatar } from "@/ui/Avatar";
import { ProfileActions } from "./ProfileActions";

export const dynamic = "force-dynamic";

/**
 * COM-10 Member Profile (mockup 83). Signed-in members only; respects privacy.profileVisibility.
 * Shows only public facts: name, avatar, bio, role, public posts and projects, follow counts.
 */
export default async function MemberProfilePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const me = await requireMember(`/members/${id}`);
  const actor = toActor(me);
  const m = await one<{ id: string; full_name: string; avatar_url: string | null; bio: string; role: string; department: string | null; privacy: string; created_at: string }>(
    "SELECT id, full_name, avatar_url, bio, role, department, privacy, created_at FROM members WHERE id = ? AND deleted_at IS NULL AND locked = 0",
    [id],
  );
  if (!m) notFound();
  let visible = true;
  try {
    visible = (JSON.parse(m.privacy) as { profileVisibility?: string }).profileVisibility !== "private";
  } catch {
    visible = true;
  }
  const self = me.id === m.id;
  if (!visible && !self) notFound();
  const [stats, posts, projects] = await Promise.all([
    socialStats(actor, id),
    feed(actor, { authorId: id, limit: 20 }),
    all<{ id: string; title: string; role: string }>(
      `SELECT p.id, p.title, pm.role FROM prj_members pm JOIN prj_projects p ON p.id = pm.project_id
       WHERE pm.member_id = ? AND pm.status = 'active' AND p.status IN ('active','completed') ORDER BY p.updated_at DESC LIMIT 10`,
      [id],
    ),
  ]);
  return (
    <>
      <AppHeader back backFallback="/community/members" title={self ? "Hồ sơ của tôi" : "Hồ sơ thành viên"} />
      <Section>
        <div className="flex flex-col items-center gap-2 text-center">
          <Avatar name={m.full_name} url={m.avatar_url} size={88} />
          <p className="text-[19px] font-bold text-ink">{m.full_name}</p>
          <Badge>
            {isRole(m.role) ? ROLE_LABEL[m.role] : "Thành viên"}
            {isDepartment(m.department) ? ` · ${DEPARTMENT_LABEL[m.department]}` : ""}
          </Badge>
          <p className="text-[12px] text-muted">Thành viên từ {new Date(m.created_at).toLocaleDateString("vi-VN", { month: "2-digit", year: "numeric" })}</p>
          {m.bio && <p className="mt-1 text-[14px] text-ink-2">{m.bio}</p>}
          <ul className="mt-2 grid w-full grid-cols-3 text-center">
            {[
              [stats.posts, "Bài viết"],
              [stats.followers, "Người theo dõi"],
              [stats.following, "Đang theo dõi"],
            ].map(([n, l]) => (
              <li key={String(l)}>
                <span className="block text-[18px] font-extrabold text-ink">{n}</span>
                <span className="block text-[12px] text-muted">{l}</span>
              </li>
            ))}
          </ul>
          {self ? (
            <ButtonLink href="/more/account/profile" variant="secondary" block>
              Chỉnh sửa hồ sơ
            </ButtonLink>
          ) : (
            <ProfileActions memberId={id} following={stats.isFollowing} blocked={stats.blocked} />
          )}
        </div>
      </Section>
      {projects.length > 0 && (
        <Section title="Dự án">
          <ul className="divide-y divide-line overflow-hidden rounded-[var(--radius-card)] border border-line bg-surface">
            {projects.map((p) => (
              <li key={p.id}>
                <Link href={`/projects/p/${p.id}`} className="flex items-center justify-between gap-3 px-4 py-3 active:bg-surface-2">
                  <span className="truncate text-[15px] font-semibold text-ink">{p.title}</span>
                  <span className="shrink-0 text-[12px] text-muted">{p.role === "owner" ? "Chủ dự án" : p.role === "lead" ? "Trưởng nhóm" : p.role === "mentor" ? "Mentor" : "Thành viên"}</span>
                </Link>
              </li>
            ))}
          </ul>
        </Section>
      )}
      <Section title="Bài viết">
        {posts.length === 0 ? (
          <p className="text-[14px] text-muted">Chưa có bài viết công khai.</p>
        ) : (
          <ul className="space-y-3">
            {posts.map((p) => (
              <li key={p.id}>
                <PostCard p={p} signedIn />
              </li>
            ))}
          </ul>
        )}
      </Section>
    </>
  );
}

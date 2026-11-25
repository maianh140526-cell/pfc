import { FolderKanban } from "lucide-react";
import { requireMember, toActor } from "@/platform/auth/session";
import { myProjects } from "@/modules/projects/server/service";
import { ProjectCard } from "@/modules/projects/ui/ProjectCard";
import { AppHeader, ButtonLink, EmptyState, Section } from "@/ui";

export const metadata = { title: "Dự án của tôi" };
export const dynamic = "force-dynamic";

/** PRO-22 My Projects · PRO-23 Project Dashboard entry. */
export default async function MyProjectsPage() {
  const me = await requireMember("/projects/mine");
  const items = await myProjects(toActor(me));
  const invites = items.filter((p) => p.myStatus === "invited");
  const owned = items.filter((p) => p.myStatus === "active" && p.myRole === "owner");
  const joined = items.filter((p) => p.myStatus === "active" && p.myRole !== "owner");
  const requests = items.filter((p) => p.myStatus === "requested");
  if (items.length === 0) {
    return (
      <>
        <AppHeader title="Dự án của tôi" backHref="/projects" />
        <EmptyState
          icon={FolderKanban}
          title="Bạn chưa tham gia dự án nào"
          description="Tạo dự án từ ý tưởng của bạn, hoặc xin tham gia một dự án đang tuyển."
          action={
            <ButtonLink href="/projects?view=recruiting" block>
              Tìm dự án đang tuyển
            </ButtonLink>
          }
        />
      </>
    );
  }
  const group = (title: string, list: typeof items) =>
    list.length > 0 && (
      <Section title={`${title} (${list.length})`}>
        <ul className="space-y-3">
          {list.map((p) => (
            <li key={p.id}>
              <ProjectCard p={p} myRole={p.myRole} myStatus={p.myStatus} showStatus />
            </li>
          ))}
        </ul>
      </Section>
    );
  return (
    <>
      <AppHeader title="Dự án của tôi" backHref="/projects" />
      {group("Lời mời", invites)}
      {group("Tôi quản lý", owned)}
      {group("Tôi tham gia", joined)}
      {group("Đang xin tham gia", requests)}
    </>
  );
}

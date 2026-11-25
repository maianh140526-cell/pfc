import { ShieldAlert, ShieldCheck } from "lucide-react";
import { requireMember, toActor } from "@/platform/auth/session";
import { can } from "@/platform/roles";
import { approvalQueue } from "@/modules/projects/server/service";
import { ProjectCard } from "@/modules/projects/ui/ProjectCard";
import { AppHeader, EmptyState } from "@/ui";

export const metadata = { title: "Duyệt dự án" };
export const dynamic = "force-dynamic";

/** PRO-26 approval queue (FR-PROJ-006). Open a project to approve / reject with a reason. */
export default async function ManageProjectsPage() {
  const me = await requireMember("/projects/manage");
  const actor = toActor(me);
  if (!can(actor, "project.approve")) {
    return (
      <>
        <AppHeader back backFallback="/projects/more" title="Duyệt dự án" />
        <EmptyState icon={ShieldAlert} title="Không có quyền" description="Chủ nhiệm, Ban điều hành và Trưởng ban Chuyên môn duyệt dự án." />
      </>
    );
  }
  const queue = await approvalQueue(actor);
  return (
    <>
      <AppHeader back backFallback="/projects/more" title="Duyệt dự án" />
      {queue.length === 0 ? (
        <EmptyState icon={ShieldCheck} title="Không có dự án chờ duyệt" />
      ) : (
        <ul className="space-y-3 px-4">
          {queue.map((p) => (
            <li key={p.id}>
              <ProjectCard p={p} showStatus />
            </li>
          ))}
        </ul>
      )}
    </>
  );
}

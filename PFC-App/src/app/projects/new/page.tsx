import { requireMember } from "@/platform/auth/session";
import { ProjectForm } from "@/modules/projects/ui/ProjectForm";
import { AppHeader } from "@/ui";

export const metadata = { title: "Tạo dự án" };
export const dynamic = "force-dynamic";

export default async function NewProjectPage() {
  await requireMember("/projects/new");
  return (
    <>
      <AppHeader title="Tạo dự án" backHref="/projects" subtitle="Đăng ý tưởng, tìm đồng đội & mentor" />
      <ProjectForm />
    </>
  );
}

import { ShieldCheck, UserSearch, Users } from "lucide-react";
import { requireMember, toActor } from "@/platform/auth/session";
import { can } from "@/platform/roles";
import { AppHeader, ListGroup, ListItem, Section } from "@/ui";

export const metadata = { title: "Thêm" };
export const dynamic = "force-dynamic";

export default async function ProjectsMorePage() {
  const me = await requireMember("/projects/more");
  const canApprove = can(toActor(me), "project.approve");
  return (
    <>
      <AppHeader title="Thêm" backHref="/projects" />
      <Section>
        <ListGroup>
          <ListItem icon={UserSearch} title="Tìm cộng sự" description="Hồ sơ kỹ năng của thành viên đang tìm dự án" href="/projects/collab" />
          {canApprove && <ListItem icon={ShieldCheck} title="Duyệt dự án" description="Dự án đang chờ duyệt để công khai" href="/projects/manage" />}
          <ListItem icon={Users} title="Ai được làm gì trong dự án" description="Chủ dự án · Trưởng nhóm · Thành viên · Mentor" href="/more/roles" />
        </ListGroup>
      </Section>
      <Section>
        <p className="text-[12px] leading-relaxed text-muted">
          Dự án công khai sau khi được Chủ nhiệm, Ban điều hành hoặc Trưởng ban Chuyên môn duyệt.
        </p>
      </Section>
    </>
  );
}

import { GraduationCap } from "lucide-react";
import { requireMember } from "@/platform/auth/session";
import { listMentors } from "@/modules/projects/server/service";
import { AppHeader, EmptyState, Section } from "@/ui";

export const metadata = { title: "Mentor" };
export const dynamic = "force-dynamic";

/** PRO-10 Mentor Discovery: members currently mentoring public projects. */
export default async function MentorsPage() {
  await requireMember("/projects/mentors");
  const mentors = await listMentors();
  return (
    <>
      <AppHeader title="Mentor" backHref="/projects" subtitle="Những người đang đồng hành cùng các dự án" />
      {mentors.length === 0 ? (
        <EmptyState icon={GraduationCap} title="Chưa có mentor" description="Mở một dự án đang hoạt động và chọn “Đề nghị làm mentor” để đồng hành cùng đội." />
      ) : (
        <Section>
          <ul className="divide-y divide-line overflow-hidden rounded-[var(--radius-card)] border border-line bg-surface">
            {mentors.map((m) => (
              <li key={m.memberId} className="flex items-center gap-3 px-4 py-3">
                <span className="grid size-10 shrink-0 place-items-center rounded-full bg-primary-soft text-[15px] font-bold text-primary">{m.name.slice(0, 1).toUpperCase()}</span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-[15px] font-semibold text-ink">{m.name}</span>
                  <span className="block text-[12px] text-muted">Đang mentor {m.projects} dự án</span>
                </span>
              </li>
            ))}
          </ul>
          <p className="mt-2 text-[12px] text-muted">Muốn mời mentor? Chủ dự án mời bằng email trong mục Thành viên của không gian làm việc.</p>
        </Section>
      )}
    </>
  );
}

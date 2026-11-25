import { notFound } from "next/navigation";
import { requireMember, toActor } from "@/platform/auth/session";
import { getCourse } from "@/modules/education/server/service";
import { AppHeader, ButtonLink, Section } from "@/ui";
import { CourseEditor } from "./CourseEditor";

export const dynamic = "force-dynamic";

/** EDU-A02 Course Management + EDU-A03 Lesson Management. */
export default async function EditCoursePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const me = await requireMember(`/learn/manage/courses/${id}`);
  const c = await getCourse(toActor(me), id);
  if (!c || (!c.isAuthor && !c.canApprove)) notFound();
  return (
    <>
      <AppHeader back backFallback="/learn/manage" title="Quản lý khóa học" />
      <CourseEditor
        course={{
          id: c.id,
          title: c.title,
          summary: c.summary,
          description: c.description,
          topic: c.topic,
          level: c.level,
          status: c.status,
          rejectReason: c.rejectReason,
          isAuthor: c.isAuthor,
          canApprove: c.canApprove,
          canEdit: c.canEdit,
          canDelete: c.canDelete,
        }}
        lessons={c.lessons.map((l) => ({ id: l.id, title: l.title, kind: l.kind, videoUrl: l.videoUrl ?? "", body: l.body, durationMin: l.durationMin }))}
      />
      {c.status === "published" && (
        <Section>
          <ButtonLink href={`/learn/courses/${c.id}`} variant="ghost" block>
            Xem trang khóa học
          </ButtonLink>
        </Section>
      )}
    </>
  );
}

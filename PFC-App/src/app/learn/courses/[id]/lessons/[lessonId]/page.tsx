import { notFound, redirect } from "next/navigation";
import { requireMember, toActor } from "@/platform/auth/session";
import { getCourse } from "@/modules/education/server/service";
import { AppHeader, ButtonLink, Section } from "@/ui";
import { ProgressBar } from "@/ui/ProgressBar";
import { CompleteLesson } from "./CompleteLesson";

export const dynamic = "force-dynamic";

/** EDU-05 Learning Content / EDU-06 Video Player / EDU-07 Reading (mockup 41 / 42). */
export default async function LessonPage({ params }: { params: Promise<{ id: string; lessonId: string }> }) {
  const { id, lessonId } = await params;
  const me = await requireMember(`/learn/courses/${id}/lessons/${lessonId}`);
  const c = await getCourse(toActor(me), id);
  if (!c) notFound();
  const idx = c.lessons.findIndex((l) => l.id === lessonId);
  if (idx < 0) notFound();
  if (!c.enrolled && !c.isAuthor && !c.canApprove) redirect(`/learn/courses/${id}`);
  const lesson = c.lessons[idx];
  const prev = c.lessons[idx - 1];
  const next = c.lessons[idx + 1];

  return (
    <>
      <AppHeader back backFallback={`/learn/courses/${id}`} title={c.title} />
      <div className="px-4">
        <ProgressBar value={c.progress.pct} label={`Tiến độ khóa học ${c.progress.pct}%`} />
        <p className="mt-1 text-[12px] text-muted">
          Bài {idx + 1}/{c.lessons.length} · {c.progress.pct}% hoàn thành
        </p>
      </div>
      {lesson.kind === "video" && lesson.embedUrl && (
        <div className="mt-3 aspect-video w-full bg-black">
          <iframe
            src={lesson.embedUrl}
            title={lesson.title}
            className="h-full w-full"
            allow="accelerometer; encrypted-media; gyroscope; picture-in-picture; fullscreen"
            allowFullScreen
            loading="lazy"
            referrerPolicy="strict-origin-when-cross-origin"
            sandbox="allow-scripts allow-same-origin allow-presentation allow-popups"
          />
        </div>
      )}
      <Section>
        <h1 className="text-[20px] leading-tight font-extrabold text-ink">{lesson.title}</h1>
        <p className="mt-1 text-[13px] text-muted">
          {lesson.kind === "video" ? "Video" : "Bài đọc"} · {lesson.durationMin} phút
        </p>
        {lesson.body && <div className="mt-3 text-[15px] leading-relaxed whitespace-pre-line text-ink-2">{lesson.body}</div>}
      </Section>
      <Section>
        {c.enrolled && <CompleteLesson lessonId={lesson.id} done={lesson.done} nextHref={next ? `/learn/courses/${id}/lessons/${next.id}` : `/learn/courses/${id}`} isLast={!next} />}
        <div className="mt-3 grid grid-cols-2 gap-3">
          {prev ? (
            <ButtonLink href={`/learn/courses/${id}/lessons/${prev.id}`} variant="secondary">
              ‹ Bài trước
            </ButtonLink>
          ) : (
            <span />
          )}
          {next && (
            <ButtonLink href={`/learn/courses/${id}/lessons/${next.id}`} variant="secondary">
              Bài tiếp ›
            </ButtonLink>
          )}
        </div>
      </Section>
    </>
  );
}

import Link from "next/link";
import { notFound } from "next/navigation";
import { Award, BookOpen, CheckCircle2, Circle, Clock, FileText, PlayCircle, Users } from "lucide-react";
import { currentMember, toActor } from "@/platform/auth/session";
import { LEVEL_LABEL, TOPIC_LABEL } from "@/modules/education/domain/learning";
import { getCourse } from "@/modules/education/server/service";
import { AppHeader, Badge, ButtonLink, Card, Section } from "@/ui";
import { ProgressBar } from "@/ui/ProgressBar";
import { EnrollButton } from "./EnrollButton";

export const dynamic = "force-dynamic";

/** EDU-03 Course Detail + EDU-04 Enrollment (mockup 39 / 40 / 144). */
export default async function CourseDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const me = await currentMember();
  const c = await getCourse(me ? toActor(me) : null, id);
  if (!c) notFound();
  const next = c.lessons.find((l) => !l.done) ?? c.lessons[0];

  return (
    <>
      <AppHeader back backFallback="/learn/courses" title="Chi tiết khóa học" />
      <div className="px-4">
        <div className={`flex h-32 items-center justify-center rounded-[var(--radius-card)] ${c.topic === "finance" ? "bg-income-soft text-income" : "bg-primary-soft text-primary"}`}>
          <BookOpen size={52} />
        </div>
        <h1 className="mt-4 text-[22px] leading-tight font-extrabold text-ink">{c.title}</h1>
        {c.summary && <p className="mt-1 text-[14px] text-ink-2">{c.summary}</p>}
        <div className="mt-3 flex flex-wrap gap-2">
          <Badge>{TOPIC_LABEL[c.topic]}</Badge>
          <Badge tone="muted">{LEVEL_LABEL[c.level]}</Badge>
          <Badge tone="income">Miễn phí</Badge>
        </div>
        <p className="mt-3 flex flex-wrap gap-4 text-[13px] text-muted">
          <span className="flex items-center gap-1">
            <BookOpen size={14} /> {c.lessonCount} bài học
          </span>
          <span className="flex items-center gap-1">
            <Clock size={14} /> {c.durationMin} phút
          </span>
          <span className="flex items-center gap-1">
            <Users size={14} /> {c.learners} học viên
          </span>
        </p>
        <p className="mt-1 text-[13px] text-muted">Giảng viên: {c.authorName}</p>
      </div>

      {(c.isAuthor || c.canApprove) && (
        <Section>
          <ButtonLink href={`/learn/manage/courses/${c.id}`} variant="secondary" block>
            Quản lý khóa học
          </ButtonLink>
        </Section>
      )}

      {c.status === "published" && (
        <Section>
          {c.enrolled ? (
            <Card>
              <div className="flex items-baseline justify-between">
                <span className="text-[14px] font-semibold text-ink">{c.completedAt ? "Đã hoàn thành" : "Tiến độ của bạn"}</span>
                <span className="text-[14px] font-bold text-primary">{c.progress.pct}%</span>
              </div>
              <ProgressBar className="mt-2" value={c.progress.pct} tone={c.completedAt ? "income" : "primary"} label={`Tiến độ ${c.progress.pct}%`} />
              <div className="mt-3 grid gap-2">
                {next && (
                  <ButtonLink href={`/learn/courses/${c.id}/lessons/${next.id}`} block>
                    <PlayCircle size={18} /> {c.progress.pct === 0 ? "Bắt đầu học" : c.completedAt ? "Học lại" : "Học tiếp"}
                  </ButtonLink>
                )}
                {c.completedAt && (
                  <ButtonLink href={`/learn/courses/${c.id}/certificate`} variant="secondary" block>
                    <Award size={18} /> Xem chứng chỉ
                  </ButtonLink>
                )}
              </div>
            </Card>
          ) : me ? (
            <EnrollButton courseId={c.id} firstLessonId={c.lessons[0]?.id} />
          ) : (
            <ButtonLink href={`/login?next=/learn/courses/${c.id}`} block>
              Đăng nhập để đăng ký học
            </ButtonLink>
          )}
        </Section>
      )}

      {c.description && (
        <Section title="Về khóa học">
          <p className="text-[15px] leading-relaxed whitespace-pre-line text-ink-2">{c.description}</p>
        </Section>
      )}

      <Section title={`Nội dung (${c.lessons.length} bài)`}>
        <ol className="divide-y divide-line overflow-hidden rounded-[var(--radius-card)] border border-line bg-surface">
          {c.lessons.map((l) => {
            const Icon = l.kind === "video" ? PlayCircle : FileText;
            const inner = (
              <>
                {l.done ? <CheckCircle2 size={20} className="shrink-0 text-income" /> : <Circle size={20} className="shrink-0 text-line" />}
                <span className="min-w-0 flex-1">
                  <span className="block text-[15px] font-semibold text-ink">
                    {l.position}. {l.title}
                  </span>
                  <span className="flex items-center gap-1 text-[12px] text-muted">
                    <Icon size={13} /> {l.kind === "video" ? "Video" : "Bài đọc"} · {l.durationMin} phút
                  </span>
                </span>
              </>
            );
            return (
              <li key={l.id}>
                {c.enrolled || c.isAuthor || c.canApprove ? (
                  <Link href={`/learn/courses/${c.id}/lessons/${l.id}`} className="pressable flex items-center gap-3 px-4 py-3 active:bg-surface-2">
                    {inner}
                  </Link>
                ) : (
                  <div className="flex items-center gap-3 px-4 py-3">{inner}</div>
                )}
              </li>
            );
          })}
        </ol>
      </Section>
    </>
  );
}

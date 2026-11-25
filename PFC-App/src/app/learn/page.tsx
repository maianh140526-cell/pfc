import Link from "next/link";
import { BookOpen, ClipboardCheck, FileText, GraduationCap, MessagesSquare } from "lucide-react";
import { currentMember, toActor } from "@/platform/auth/session";
import { eduHomeStats, listPublishedCourses, listPublishedQuizzes, myLearning } from "@/modules/education/server/service";
import { CourseCard } from "@/modules/education/ui/CourseCard";
import { ShareBar } from "@/modules/education/ui/ShareBar";
import { AppHeader, ButtonLink, Card, EmptyState, Section } from "@/ui";

export const dynamic = "force-dynamic";

/** EDU-01 Education Hub Home (mockup 37 / 114). */
export default async function LearnHome() {
  const me = await currentMember();
  const [courses, quizzes, stats, mine] = await Promise.all([
    listPublishedCourses(),
    listPublishedQuizzes(),
    eduHomeStats(),
    me ? myLearning(toActor(me)) : Promise.resolve(null),
  ]);
  const continuing = mine?.courses.filter((c) => !c.completedAt).slice(0, 2) ?? [];

  return (
    <>
      <AppHeader backHref="/home" title="Education Hub" subtitle="Học hôm nay, vững tương lai" />
      <div className="px-4">
        <div className="rounded-[var(--radius-card)] bg-primary p-5 text-on-primary shadow-sheet">
          <p className="text-[18px] leading-snug font-extrabold">Tài chính cá nhân & phát triển bản thân</p>
          <p className="mt-1 text-[13px] opacity-90">
            {stats.courses} khóa học · {stats.quizzes} bài kiểm tra · {stats.resources} tài liệu
          </p>
          <Link href="/learn/courses" className="mt-3 inline-flex rounded-full bg-on-primary px-4 py-2 text-[13px] font-bold text-primary">
            Bắt đầu học ngay
          </Link>
        </div>
      </div>
      <Section>
        <ul className="grid grid-cols-4 gap-2 text-center">
          {[
            { href: "/learn/courses", label: "Khóa học", icon: GraduationCap },
            { href: "/learn/quizzes", label: "Kiểm tra", icon: ClipboardCheck },
            { href: "/learn/resources", label: "Tài liệu", icon: FileText },
            { href: "/learn/forum", label: "Diễn đàn", icon: MessagesSquare },
          ].map(({ href, label, icon: Icon }) => (
            <li key={href}>
              <Link href={href} className="pressable flex flex-col items-center gap-1.5 text-[12px] font-semibold text-ink-2">
                <span className="grid size-12 place-items-center rounded-2xl bg-primary-soft text-primary">
                  <Icon size={22} />
                </span>
                {label}
              </Link>
            </li>
          ))}
        </ul>
      </Section>

      <Section title="Chia sẻ với cộng đồng">
        <ShareBar />
      </Section>

      {continuing.length > 0 && (
        <Section title="Tiếp tục học">
          <div className="space-y-3">
            {continuing.map((c) => (
              <CourseCard key={c.id} c={c} progressPct={c.progress.pct} />
            ))}
          </div>
        </Section>
      )}

      <Section
        title="Khóa học nổi bật"
        action={
          <Link href="/learn/courses" className="text-[14px] font-semibold text-primary">
            Xem tất cả
          </Link>
        }
      >
        {courses.length === 0 ? (
          <EmptyState icon={BookOpen} title="Chưa có khóa học" description="Ban Chuyên môn đang chuẩn bị nội dung. Quay lại sau nhé." />
        ) : (
          <div className="space-y-3">
            {courses.slice(0, 4).map((c) => (
              <CourseCard key={c.id} c={c} />
            ))}
          </div>
        )}
      </Section>

      {quizzes.length > 0 && (
        <Section
          title="Kiểm tra kiến thức"
          action={
            <Link href="/learn/quizzes" className="text-[14px] font-semibold text-primary">
              Xem tất cả
            </Link>
          }
        >
          <ul className="space-y-2">
            {quizzes.slice(0, 3).map((q) => (
              <li key={q.id}>
                <Link href={`/learn/quizzes/${q.id}`} className="pressable flex items-center gap-3 rounded-2xl border border-line bg-surface p-3">
                  <span className="grid size-11 place-items-center rounded-xl bg-warning-soft text-warning">
                    <ClipboardCheck size={20} />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-[15px] font-semibold text-ink">{q.title}</span>
                    <span className="block text-[12px] text-muted">
                      {q.questionCount} câu · đạt từ {q.passPct}%
                    </span>
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </Section>
      )}

      {!me && (
        <Section>
          <Card className="text-center">
            <p className="text-[14px] text-ink-2">Đăng nhập để lưu tiến độ, làm bài kiểm tra và nhận chứng chỉ.</p>
            <div className="mt-3">
              <ButtonLink href="/login?next=/learn" block>
                Đăng nhập
              </ButtonLink>
            </div>
          </Card>
        </Section>
      )}
    </>
  );
}

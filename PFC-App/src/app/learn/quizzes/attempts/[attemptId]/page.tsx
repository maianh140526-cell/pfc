import { notFound } from "next/navigation";
import { CheckCircle2, Trophy, XCircle } from "lucide-react";
import { requireMember, toActor } from "@/platform/auth/session";
import { getAttempt } from "@/modules/education/server/service";
import { AppHeader, ButtonLink, Section } from "@/ui";
import { cx } from "@/ui/cx";

export const dynamic = "force-dynamic";

/** EDU-12 Test Result (mockup 45 / 123): score + per-question review with explanations. */
export default async function AttemptPage({ params }: { params: Promise<{ attemptId: string }> }) {
  const { attemptId } = await params;
  const me = await requireMember(`/learn/quizzes/attempts/${attemptId}`);
  const a = await getAttempt(toActor(me), attemptId);
  if (!a) notFound();
  const pct = a.total ? Math.round((a.score / a.total) * 100) : 0;
  return (
    <>
      <AppHeader back backFallback="/learn/quizzes" title="Kết quả bài kiểm tra" />
      <div className="flex flex-col items-center px-4 pt-2 text-center">
        <span className={cx("grid size-20 place-items-center rounded-full", a.passed ? "bg-warning-soft text-warning" : "bg-surface-2 text-muted")}>
          <Trophy size={40} />
        </span>
        <h1 className="mt-3 text-[20px] font-extrabold text-ink">{a.passed ? "Chúc mừng, bạn đã đạt!" : "Chưa đạt, thử lại nhé!"}</h1>
        <p className="mt-1 text-[14px] text-muted">{a.title}</p>
        <p className="mt-3 text-[40px] font-extrabold text-primary">
          {a.score}/{a.total}
        </p>
        <p className="text-[14px] text-ink-2">
          Điểm số {pct}% · cần {a.passPct}% để đạt
        </p>
      </div>
      <Section title="Đáp án chi tiết">
        <ol className="space-y-3">
          {a.questions.map((q, i) => {
            const right = q.chosen === q.correctIndex;
            return (
              <li key={q.id} className="rounded-[var(--radius-card)] border border-line bg-surface p-4">
                <p className="flex gap-2 text-[15px] font-semibold text-ink">
                  {right ? <CheckCircle2 size={20} className="shrink-0 text-income" /> : <XCircle size={20} className="shrink-0 text-expense" />}
                  <span>
                    {i + 1}. {q.prompt}
                  </span>
                </p>
                <ul className="mt-2 space-y-1 text-[14px]">
                  {q.options.map((o, idx) => (
                    <li
                      key={idx}
                      className={cx(
                        "rounded-lg px-3 py-1.5",
                        idx === q.correctIndex ? "bg-income-soft font-semibold text-income" : idx === q.chosen ? "bg-expense-soft text-expense" : "text-ink-2",
                      )}
                    >
                      {String.fromCharCode(65 + idx)}. {o}
                      {idx === q.correctIndex ? " ✓" : idx === q.chosen ? " (bạn chọn)" : ""}
                    </li>
                  ))}
                </ul>
                {q.chosen === null && <p className="mt-1 text-[13px] text-expense">Bạn bỏ trống câu này.</p>}
                {q.explanation && <p className="mt-2 text-[13px] text-muted">Giải thích: {q.explanation}</p>}
              </li>
            );
          })}
        </ol>
      </Section>
      <Section>
        <div className="grid gap-3">
          <ButtonLink href={`/learn/quizzes/${a.quizId}`} block>
            Làm lại bài kiểm tra
          </ButtonLink>
          <ButtonLink href="/learn/quizzes" variant="secondary" block>
            Bài kiểm tra khác
          </ButtonLink>
        </div>
      </Section>
    </>
  );
}

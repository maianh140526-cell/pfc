import Link from "next/link";
import { ClipboardCheck } from "lucide-react";
import { currentMember, toActor } from "@/platform/auth/session";
import { TOPIC_LABEL } from "@/modules/education/domain/learning";
import { listPublishedQuizzes, myLearning } from "@/modules/education/server/service";
import { ShareBar } from "@/modules/education/ui/ShareBar";
import { AppHeader, Badge, EmptyState } from "@/ui";
import { FilterChips } from "@/ui/FilterChips";

export const metadata = { title: "Bài kiểm tra" };
export const dynamic = "force-dynamic";

/** EDU-09 Question Bank / EDU-10 Quiz list (mockup 122). */
export default async function QuizzesPage({ searchParams }: { searchParams: Promise<{ topic?: string }> }) {
  const { topic } = await searchParams;
  const me = await currentMember();
  const [quizzes, mine] = await Promise.all([listPublishedQuizzes({ topic }), me ? myLearning(toActor(me)) : null]);
  const best = new Map(mine?.attempts.map((a) => [a.quizId, a]) ?? []);
  return (
    <>
      <AppHeader title="Bài kiểm tra" backHref="/learn" />
      <div className="space-y-3 px-4">
        <ShareBar />
        <FilterChips
          label="Chủ đề"
          value={topic === "finance" || topic === "development" ? topic : "all"}
          hrefFor={(t) => (t === "all" ? "/learn/quizzes" : `/learn/quizzes?topic=${t}`)}
          options={[
            { value: "all", label: "Tất cả" },
            { value: "finance", label: "Tài chính" },
            { value: "development", label: "Phát triển bản thân" },
          ]}
        />
      </div>
      {quizzes.length === 0 ? (
        <EmptyState icon={ClipboardCheck} title="Chưa có bài kiểm tra" />
      ) : (
        <ul className="space-y-3 px-4 pt-3">
          {quizzes.map((q) => {
            const b = best.get(q.id);
            return (
              <li key={q.id}>
                <Link href={`/learn/quizzes/${q.id}`} className="pressable flex items-center gap-3 rounded-[var(--radius-card)] border border-line bg-surface p-3.5 shadow-card">
                  <span className="grid size-12 shrink-0 place-items-center rounded-2xl bg-warning-soft text-warning">
                    <ClipboardCheck size={22} />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block text-[15px] font-bold text-ink">{q.title}</span>
                    <span className="block text-[12px] text-muted">
                      {TOPIC_LABEL[q.topic]} · {q.questionCount} câu · đạt từ {q.passPct}%
                    </span>
                  </span>
                  {b && <Badge tone={b.passed ? "income" : "warning"}>{`${b.best}/${b.total}`}</Badge>}
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </>
  );
}

import { notFound } from "next/navigation";
import { currentMember, toActor } from "@/platform/auth/session";
import { getQuizForTaking } from "@/modules/education/server/service";
import { AppHeader, ButtonLink, Card, Section } from "@/ui";
import { AttachmentList } from "@/ui/AttachmentPicker";
import { QuizRunner } from "./QuizRunner";

export const dynamic = "force-dynamic";

/** EDU-10 Quiz / EDU-11 Test (mockup 44). Correct answers are never sent to the browser. */
export default async function QuizPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const me = await currentMember();
  const quiz = await getQuizForTaking(me ? toActor(me) : null, id);
  if (!quiz) notFound();
  return (
    <>
      <AppHeader back backFallback="/learn/quizzes" title={quiz.title} />
      {(quiz.subject || quiz.attachments.length > 0) && (
        <Section title={quiz.subject ? `Môn: ${quiz.subject}` : "Tài liệu kèm theo"}>
          {quiz.attachments.length > 0 && <AttachmentList items={quiz.attachments} />}
        </Section>
      )}
      {!me ? (
        <Section>
          <Card className="text-center">
            <p className="text-[14px] text-ink-2">
              {quiz.questionCount} câu hỏi · đạt từ {quiz.passPct}%. Đăng nhập để làm bài và lưu kết quả.
            </p>
            <div className="mt-3">
              <ButtonLink href={`/login?next=/learn/quizzes/${id}`} block>
                Đăng nhập để làm bài
              </ButtonLink>
            </div>
          </Card>
        </Section>
      ) : quiz.questions.length === 0 ? (
        <Section>
          <Card className="text-center text-[14px] text-muted">Bài kiểm tra chưa có câu hỏi.</Card>
        </Section>
      ) : (
        <QuizRunner quizId={quiz.id} questions={quiz.questions} passPct={quiz.passPct} timeLimitMin={quiz.timeLimitMin} />
      )}
    </>
  );
}

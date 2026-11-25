"use client";

import { useRouter } from "next/navigation";
import { CheckCircle2 } from "lucide-react";
import { completeLessonAction } from "@/modules/education/server/actions";
import { Button } from "@/ui";
import { FormError } from "@/ui/Form";
import { useAction } from "@/ui/use-action";

export function CompleteLesson({ lessonId, done, nextHref, isLast }: { lessonId: string; done: boolean; nextHref: string; isLast: boolean }) {
  const router = useRouter();
  const { run, pending, error } = useAction();
  if (done) {
    return (
      <p className="flex items-center justify-center gap-2 rounded-[var(--radius-control)] bg-income-soft py-3 text-[15px] font-semibold text-income">
        <CheckCircle2 size={20} /> Đã hoàn thành bài này
      </p>
    );
  }
  return (
    <>
      <Button block disabled={pending} onClick={() => run(() => completeLessonAction(lessonId), () => router.push(nextHref))}>
        <CheckCircle2 size={18} /> {pending ? "Đang lưu…" : isLast ? "Hoàn thành khóa học" : "Hoàn thành & học tiếp"}
      </Button>
      <div className="mt-2">
        <FormError message={error} />
      </div>
    </>
  );
}

"use client";

import { useRouter } from "next/navigation";
import { enrollAction } from "@/modules/education/server/actions";
import { Button } from "@/ui";
import { FormError } from "@/ui/Form";
import { useAction } from "@/ui/use-action";

export function EnrollButton({ courseId, firstLessonId }: { courseId: string; firstLessonId?: string }) {
  const router = useRouter();
  const { run, pending, error } = useAction();
  return (
    <>
      <Button
        block
        disabled={pending}
        onClick={() => run(() => enrollAction(courseId), () => firstLessonId && router.push(`/learn/courses/${courseId}/lessons/${firstLessonId}`))}
      >
        {pending ? "Đang đăng ký…" : "Đăng ký học miễn phí"}
      </Button>
      <div className="mt-2">
        <FormError message={error} />
      </div>
    </>
  );
}

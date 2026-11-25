"use client";

import { useRouter } from "next/navigation";
import { createCourseAction } from "@/modules/education/server/actions";
import { AppHeader } from "@/ui";
import { CourseForm } from "../CourseForm";

/** EDU-A02 Course Management — create. */
export default function NewCoursePage() {
  const router = useRouter();
  return (
    <>
      <AppHeader back backFallback="/learn/manage" title="Khóa học mới" />
      <CourseForm submitLabel="Tạo khóa học" onSubmit={(v) => createCourseAction(v)} onDone={(id) => router.replace(`/learn/manage/courses/${id}`)} />
    </>
  );
}

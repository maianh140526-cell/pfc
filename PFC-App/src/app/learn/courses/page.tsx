import { BookOpen } from "lucide-react";
import { listPublishedCourses } from "@/modules/education/server/service";
import { CourseCard } from "@/modules/education/ui/CourseCard";
import { AppHeader, EmptyState } from "@/ui";
import { FilterChips } from "@/ui/FilterChips";
import { SearchBox } from "@/ui/SearchBox";

export const metadata = { title: "Khóa học" };
export const dynamic = "force-dynamic";

/** EDU-02 Course / Learning List (mockup 38 / 143). */
export default async function CoursesPage({ searchParams }: { searchParams: Promise<{ q?: string; topic?: string }> }) {
  const { q, topic } = await searchParams;
  const courses = await listPublishedCourses({ q: q?.slice(0, 80), topic });
  const href = (t: string) => {
    const p = new URLSearchParams();
    if (t !== "all") p.set("topic", t);
    if (q) p.set("q", q);
    return `/learn/courses?${p.toString()}`;
  };
  return (
    <>
      <AppHeader title="Khóa học" backHref="/learn" />
      <div className="space-y-3 px-4">
        <SearchBox placeholder="Tìm khóa học…" />
        <FilterChips
          label="Chủ đề"
          value={topic === "finance" || topic === "development" ? topic : "all"}
          hrefFor={href}
          options={[
            { value: "all", label: "Tất cả" },
            { value: "finance", label: "Tài chính cá nhân" },
            { value: "development", label: "Phát triển bản thân" },
          ]}
        />
      </div>
      {courses.length === 0 ? (
        <EmptyState icon={BookOpen} title="Không có khóa học phù hợp" />
      ) : (
        <div className="space-y-3 px-4 pt-3">
          {courses.map((c) => (
            <CourseCard key={c.id} c={c} />
          ))}
        </div>
      )}
    </>
  );
}

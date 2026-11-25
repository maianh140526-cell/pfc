import Link from "next/link";
import { FolderKanban, Lightbulb } from "lucide-react";
import { requireMember, toActor } from "@/platform/auth/session";
import { PROJECT_CATEGORIES } from "@/modules/projects/domain/projects";
import { listProjects, projectHomeStats } from "@/modules/projects/server/service";
import { ProjectCard } from "@/modules/projects/ui/ProjectCard";
import { AppHeader, ButtonLink, Card, EmptyState } from "@/ui";
import { FilterChips } from "@/ui/FilterChips";
import { SearchBox } from "@/ui/SearchBox";

export const dynamic = "force-dynamic";

/** PRO-01 Home · PRO-02 List · PRO-03 Search / Filter. */
export default async function ProjectsHome({ searchParams }: { searchParams: Promise<{ q?: string; category?: string; view?: string }> }) {
  const { q, category, view } = await searchParams;
  const me = await requireMember("/projects");
  const v = view === "recruiting" || view === "completed" ? view : "all";
  const [items, stats] = await Promise.all([
    listProjects({ q: q?.slice(0, 80), category, recruiting: v === "recruiting", status: v === "completed" ? "completed" : undefined }),
    projectHomeStats(toActor(me)),
  ]);
  const qs = (patch: Record<string, string | undefined>) => {
    const p = new URLSearchParams();
    for (const [k, val] of Object.entries({ q, category, view, ...patch })) if (val) p.set(k, val);
    return `/projects?${p.toString()}`;
  };
  return (
    <>
      <AppHeader backHref="/home" title="Dự án" subtitle="Học xong thì làm thật: tìm đội, tìm mentor, ra sản phẩm" />
      <div className="px-4">
        <div className="rounded-[var(--radius-card)] bg-primary p-5 text-on-primary shadow-sheet">
          <p className="text-[18px] leading-snug font-extrabold">{stats.active} dự án đang hoạt động</p>
          <p className="mt-1 text-[13px] opacity-90">
            {stats.recruiting} dự án đang tuyển thành viên · bạn tham gia {stats.mine}
          </p>
          <div className="mt-3 flex gap-2">
            <Link href="/projects/new" className="inline-flex rounded-full bg-on-primary px-4 py-2 text-[13px] font-bold text-primary">
              Đăng ý tưởng
            </Link>
            <Link href={qs({ view: "recruiting" })} className="inline-flex rounded-full border border-on-primary/60 px-4 py-2 text-[13px] font-bold">
              Tìm đội
            </Link>
          </div>
        </div>
        {stats.invites > 0 && (
          <Link href="/projects/mine" className="mt-3 block">
            <Card className="border-warning bg-warning-soft p-3.5 text-[14px] text-ink">
              Bạn có <b>{stats.invites}</b> lời mời tham gia dự án đang chờ trả lời →
            </Card>
          </Link>
        )}
      </div>
      <div className="space-y-3 px-4 pt-4">
        <SearchBox placeholder="Tìm dự án, kỹ năng…" />
        <FilterChips
          label="Hiển thị"
          value={v}
          hrefFor={(x) => qs({ view: x === "all" ? undefined : x })}
          options={[
            { value: "all", label: "Tất cả" },
            { value: "recruiting", label: "Đang tuyển" },
            { value: "completed", label: "Đã hoàn thành" },
          ]}
        />
        <FilterChips
          label="Lĩnh vực"
          value={category && category in PROJECT_CATEGORIES ? category : ""}
          hrefFor={(c) => qs({ category: c || undefined })}
          options={[{ value: "", label: "Mọi lĩnh vực" }, ...Object.entries(PROJECT_CATEGORIES).map(([value, label]) => ({ value, label }))]}
        />
      </div>
      {items.length === 0 ? (
        <EmptyState
          icon={q || category || v !== "all" ? FolderKanban : Lightbulb}
          title={q || category || v !== "all" ? "Không có dự án phù hợp" : "Chưa có dự án nào"}
          description="Hãy là người đầu tiên đăng ý tưởng và tìm đồng đội."
          action={
            <ButtonLink href="/projects/new" block>
              Tạo dự án
            </ButtonLink>
          }
        />
      ) : (
        <ul className="space-y-3 px-4 pt-3">
          {items.map((p) => (
            <li key={p.id}>
              <ProjectCard p={p} />
            </li>
          ))}
        </ul>
      )}
    </>
  );
}

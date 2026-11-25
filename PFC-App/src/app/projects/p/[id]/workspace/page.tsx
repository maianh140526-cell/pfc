import { notFound } from "next/navigation";
import { requireMember, toActor } from "@/platform/auth/session";
import { getProject, listTasks, listUpdates, projectAnalytics } from "@/modules/projects/server/service";
import { AppHeader, Card, Section } from "@/ui";
import { FilterChips } from "@/ui/FilterChips";
import { TASK_STATUS_LABEL, TASK_STATUSES } from "@/modules/projects/domain/projects";
import { ProgressBar } from "@/ui/ProgressBar";
import { LinksManager, TaskBoard, TeamManager, UpdatesFeed } from "./WorkspaceClient";

export const dynamic = "force-dynamic";

const TABS = { tasks: "Công việc", updates: "Cập nhật", team: "Thành viên", docs: "Tài liệu", stats: "Thống kê" } as const;
type Tab = keyof typeof TABS;

/** PRO-14 Workspace · PRO-15 Tasks · PRO-16/18 Timeline & discussion · PRO-17 Documents · PRO-21 Analytics · PRO-24/25 Collaborators & mentor. */
export default async function WorkspacePage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ tab?: string }> }) {
  const { id } = await params;
  const { tab } = await searchParams;
  const me = await requireMember(`/projects/p/${id}/workspace`);
  const actor = toActor(me);
  const p = await getProject(actor, id);
  if (!p || !p.caps.viewWorkspace) notFound();
  const tabs = (Object.keys(TABS) as Tab[]).filter((t) => t !== "stats" || p.caps.viewAnalytics);
  const current: Tab = tab && tabs.includes(tab as Tab) ? (tab as Tab) : "tasks";
  const readOnly = p.status !== "active" && p.status !== "draft";

  return (
    <>
      <AppHeader back backFallback={`/projects/p/${id}`} title={p.title} subtitle="Không gian làm việc" />
      <div className="px-4">
        <FilterChips label="Mục" value={current} hrefFor={(t) => `/projects/p/${id}/workspace?tab=${t}`} options={tabs.map((t) => ({ value: t, label: TABS[t] }))} />
        {readOnly && <p className="mt-2 text-[13px] text-muted">Dự án không còn hoạt động: chỉ xem.</p>}
      </div>
      {current === "tasks" && (
        <TaskBoard projectId={id} {...await listTasks(actor, id)} myId={me.id} canCreate={(p.caps.createTasks || p.caps.manageTasks) && !readOnly} canAssignOthers={p.caps.manageTasks} canClose={p.caps.manageTasks} />
      )}
      {current === "updates" && <UpdatesFeed projectId={id} updates={await listUpdates(actor, id)} canMilestone={p.caps.manageTasks} canPost={p.status !== "archived"} />}
      {current === "team" && (
        <TeamManager
          projectId={id}
          myId={me.id}
          team={p.team}
          pending={p.pending}
          caps={{ admit: p.caps.admitMembers, remove: p.caps.removeMembers, roles: p.caps.changeRoles, inviteMentor: p.caps.changeRoles }}
        />
      )}
      {current === "docs" && <LinksManager projectId={id} links={p.links} canManage={p.caps.manageLinks && p.status !== "archived"} />}
      {current === "stats" && <Stats a={await projectAnalytics(actor, id)} />}
    </>
  );
}

function Stats({ a }: { a: Awaited<ReturnType<typeof projectAnalytics>> }) {
  const tiles = [
    ["Lượt xem (30 ngày)", a.views30d],
    ["Người xem khác nhau", a.uniqueViewers],
    ["Thành viên", a.team],
    ["Mentor", a.mentors],
    ["Yêu cầu chờ duyệt", a.pendingRequests],
    ["Cập nhật (30 ngày)", a.updates30d],
  ] as const;
  return (
    <>
      <Section>
        <Card className="p-4">
          <p className="mb-1.5 flex justify-between text-[14px]">
            <span className="text-ink-2">Tiến độ</span>
            <b className="text-ink">
              {a.progress.done}/{a.progress.total} việc · {a.progress.percent}%
            </b>
          </p>
          <ProgressBar value={a.progress.percent} label="Tiến độ" tone={a.overdue > 0 ? "warning" : "primary"} />
          {a.overdue > 0 && <p className="mt-2 text-[13px] font-semibold text-warning">{a.overdue} việc quá hạn</p>}
        </Card>
      </Section>
      <Section>
        <div className="grid grid-cols-2 gap-3">
          {tiles.map(([label, v]) => (
            <Card key={label} className="p-3.5">
              <p className="text-[22px] font-extrabold text-ink">{v}</p>
              <p className="text-[12px] text-muted">{label}</p>
            </Card>
          ))}
          <Card className="col-span-2 p-3.5">
            <p className="text-[22px] font-extrabold text-ink">{a.rating ?? "—"}★</p>
            <p className="text-[12px] text-muted">{a.ratingCount} đánh giá hiển thị</p>
          </Card>
        </div>
      </Section>
      <Section title="Công việc theo trạng thái">
        <dl className="divide-y divide-line rounded-[var(--radius-card)] border border-line bg-surface text-[14px]">
          {TASK_STATUSES.map((s) => (
            <div key={s} className="flex justify-between px-4 py-2.5">
              <dt className="text-ink-2">{TASK_STATUS_LABEL[s]}</dt>
              <dd className="font-semibold text-ink">{a.tasksByStatus[s]}</dd>
            </div>
          ))}
        </dl>
      </Section>
    </>
  );
}

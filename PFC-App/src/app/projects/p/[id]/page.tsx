import Link from "next/link";
import { notFound } from "next/navigation";
import { ExternalLink, LayoutDashboard, Pencil, Star } from "lucide-react";
import { requireMember, toActor } from "@/platform/auth/session";
import { LINK_KINDS, MEMBER_ROLE_LABEL, PROJECT_CATEGORIES, PROJECT_STATUS_LABEL, PROJECT_STATUS_TONE } from "@/modules/projects/domain/projects";
import { getProject } from "@/modules/projects/server/service";
import { AppHeader, Badge, ButtonLink, Card, Section } from "@/ui";
import { ProgressBar } from "@/ui/ProgressBar";
import { FeedbackPanel, JoinPanel, ProjectStatusBar } from "./ProjectClient";

export const dynamic = "force-dynamic";

/** PRO-04 Project Detail · PRO-07 Members · PRO-19 Demo · PRO-20 Feedback · PRO-26 Approval status. */
export default async function ProjectPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const me = await requireMember(`/projects/p/${id}`);
  const p = await getProject(toActor(me), id);
  if (!p) notFound();
  const isOwner = p.ownerId === me.id;
  const showStatusBar = p.actions.length > 0 || p.canDelete || p.status !== "active";

  return (
    <>
      <AppHeader
        back
        backFallback="/projects"
        title="Chi tiết dự án"
        actions={
          p.canEdit ? (
            <Link href={`/projects/p/${p.id}/edit`} aria-label="Sửa dự án" className="grid size-11 place-items-center rounded-full text-ink active:bg-surface-2">
              <Pencil size={20} />
            </Link>
          ) : undefined
        }
      />
      <div className="px-4">
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-[13px] font-semibold text-primary">{PROJECT_CATEGORIES[p.category]}</span>
          <Badge tone={PROJECT_STATUS_TONE[p.status]}>{PROJECT_STATUS_LABEL[p.status]}</Badge>
          {p.status === "active" && p.recruiting && <Badge tone="income">Đang tuyển</Badge>}
        </div>
        <h1 className="mt-1 text-[22px] leading-tight font-extrabold text-ink">{p.title}</h1>
        <p className="mt-1 text-[14px] text-ink-2">{p.summary}</p>
        <p className="mt-2 flex items-center gap-3 text-[13px] text-muted">
          <span>Chủ dự án: {p.ownerName}</span>
          {p.rating !== null && (
            <span className="flex items-center gap-1">
              <Star size={14} className="fill-warning text-warning" /> {p.rating} ({p.ratingCount})
            </span>
          )}
        </p>
        {p.skills.length > 0 && (
          <ul className="mt-3 flex flex-wrap gap-1.5" aria-label="Kỹ năng cần">
            {p.skills.map((s) => (
              <li key={s} className="rounded-full bg-primary-soft px-2.5 py-1 text-[12px] font-semibold text-primary">
                {s}
              </li>
            ))}
          </ul>
        )}
      </div>

      {showStatusBar && (isOwner || p.actions.length > 0) && (
        <Section>
          <ProjectStatusBar id={p.id} status={p.status} actions={p.actions} rejectReason={p.rejectReason} canDelete={p.canDelete} />
        </Section>
      )}

      {p.caps.viewWorkspace && (
        <Section>
          <Card className="p-4">
            {p.progress && (
              <>
                <p className="mb-1.5 flex justify-between text-[13px]">
                  <span className="text-ink-2">Tiến độ công việc</span>
                  <b className="text-ink">
                    {p.progress.done}/{p.progress.total} · {p.progress.percent}%
                  </b>
                </p>
                <ProgressBar value={p.progress.percent} label="Tiến độ dự án" />
              </>
            )}
            <div className={p.progress ? "mt-3" : undefined}>
              <ButtonLink href={`/projects/p/${p.id}/workspace`} block>
                <LayoutDashboard size={18} /> Vào không gian làm việc
              </ButtonLink>
            </div>
          </Card>
        </Section>
      )}

      {p.status === "active" && !isOwner && (
        <Section>
          <JoinPanel id={p.id} myRole={p.myRole} myStatus={p.myStatus} recruiting={p.recruiting} />
        </Section>
      )}

      {p.description && (
        <Section title="Giới thiệu">
          <p className="text-[14px] leading-relaxed whitespace-pre-line text-ink-2">{p.description}</p>
        </Section>
      )}

      {p.links.length > 0 && (
        <Section title="Demo & tài liệu">
          <ul className="divide-y divide-line overflow-hidden rounded-[var(--radius-card)] border border-line bg-surface">
            {p.links.map((l) => (
              <li key={l.id}>
                <a href={l.url} target="_blank" rel="noopener noreferrer" className="flex items-center gap-3 px-4 py-3 active:bg-surface-2">
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-[15px] font-semibold text-ink">{l.title}</span>
                    <span className="block text-[12px] text-muted">
                      {LINK_KINDS[l.kind]} · {l.visibility === "public" ? "Công khai" : "Chỉ nhóm"}
                    </span>
                  </span>
                  <ExternalLink size={18} className="shrink-0 text-muted" />
                </a>
              </li>
            ))}
          </ul>
        </Section>
      )}

      <Section title={`Đội ngũ (${p.team.length})`}>
        <ul className="divide-y divide-line overflow-hidden rounded-[var(--radius-card)] border border-line bg-surface">
          {p.team.map((m) => (
            <li key={m.memberId} className="flex items-center gap-3 px-4 py-3">
              <span className="grid size-9 shrink-0 place-items-center rounded-full bg-primary-soft text-[14px] font-bold text-primary">{m.name.slice(0, 1).toUpperCase()}</span>
              <span className="min-w-0 flex-1">
                <span className="block truncate text-[15px] font-semibold text-ink">{m.name}</span>
                {m.role === "mentor" && m.scope && <span className="block truncate text-[12px] text-muted">Phạm vi: {m.scope}</span>}
              </span>
              <Badge tone={m.role === "owner" ? "primary" : "muted"}>{MEMBER_ROLE_LABEL[m.role]}</Badge>
            </li>
          ))}
        </ul>
      </Section>

      {(p.status === "active" || p.status === "completed") && (
        <Section title={`Phản hồi & đánh giá (${p.ratingCount})`}>
          <FeedbackPanel id={p.id} canGive={p.caps.giveFeedback} mine={p.myFeedback} feedback={p.feedback} canModerate={p.canModerateFeedback} />
        </Section>
      )}
    </>
  );
}

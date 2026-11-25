import Link from "next/link";
import { Star, Users } from "lucide-react";
import { Badge } from "@/ui";
import { MEMBER_ROLE_LABEL, PROJECT_CATEGORIES, PROJECT_STATUS_LABEL, PROJECT_STATUS_TONE, type MemberRole, type MemberStatus } from "../domain/projects";
import type { ProjectCard as Card } from "../server/service";

const MY_STATUS: Partial<Record<MemberStatus, string>> = { invited: "Bạn được mời", requested: "Đã xin tham gia" };

export function ProjectCard({ p, myRole, myStatus, showStatus }: { p: Card; myRole?: MemberRole; myStatus?: MemberStatus; showStatus?: boolean }) {
  return (
    <Link href={`/projects/p/${p.id}`} className="pressable block rounded-[var(--radius-card)] border border-line bg-surface p-4 shadow-card">
      <div className="flex items-start justify-between gap-2">
        <p className="text-[12px] font-semibold text-primary">{PROJECT_CATEGORIES[p.category]}</p>
        <div className="flex gap-1">
          {myStatus && MY_STATUS[myStatus] ? (
            <Badge tone="warning">{MY_STATUS[myStatus]}</Badge>
          ) : myRole ? (
            <Badge tone="muted">{MEMBER_ROLE_LABEL[myRole]}</Badge>
          ) : null}
          {showStatus || p.status !== "active" ? (
            <Badge tone={PROJECT_STATUS_TONE[p.status]}>{PROJECT_STATUS_LABEL[p.status]}</Badge>
          ) : p.recruiting ? (
            <Badge tone="income">Đang tuyển</Badge>
          ) : null}
        </div>
      </div>
      <p className="mt-1 text-[16px] leading-snug font-bold text-ink">{p.title}</p>
      <p className="mt-1 line-clamp-2 text-[13px] text-ink-2">{p.summary}</p>
      {p.skills.length > 0 && (
        <ul className="mt-2 flex flex-wrap gap-1.5">
          {p.skills.slice(0, 4).map((s) => (
            <li key={s} className="rounded-full bg-surface-2 px-2 py-0.5 text-[11px] font-medium text-ink-2">
              {s}
            </li>
          ))}
        </ul>
      )}
      <p className="mt-3 flex items-center gap-3 text-[12px] text-muted">
        <span className="truncate">{p.ownerName}</span>
        <span className="flex shrink-0 items-center gap-1">
          <Users size={13} /> {p.memberCount}
        </span>
        {p.rating !== null && (
          <span className="flex shrink-0 items-center gap-1">
            <Star size={13} className="fill-warning text-warning" /> {p.rating} ({p.ratingCount})
          </span>
        )}
      </p>
    </Link>
  );
}

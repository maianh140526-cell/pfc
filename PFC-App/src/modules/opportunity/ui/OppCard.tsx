"use client";

import Link from "next/link";
import { BadgeCheck, Bookmark, BookmarkCheck, Briefcase, Clock, GraduationCap, MapPin, Trophy } from "lucide-react";
import { Badge } from "@/ui";
import { cx } from "@/ui/cx";
import { TIER_LABEL, TYPE_LABEL, daysUntil, formatDate, type Opportunity, type OppType } from "../types";

export const TYPE_ICON: Record<OppType, typeof Briefcase> = {
  INTERNSHIP: GraduationCap,
  JOB: Briefcase,
  COMPETITION: Trophy,
  SCHOLARSHIP: GraduationCap,
};

export function DeadlineText({ deadline }: { deadline: string | null }) {
  const d = daysUntil(deadline);
  if (d === null) return <span className="text-muted">Không giới hạn hạn nộp</span>;
  if (d < 0) return <span className="text-expense">Đã hết hạn</span>;
  return (
    <span className={d <= 3 ? "font-semibold text-expense" : d <= 7 ? "font-semibold text-warning" : "text-muted"}>
      Hạn {formatDate(deadline)} · {d === 0 ? "hôm nay" : `còn ${d} ngày`}
    </span>
  );
}

/** Opportunity list card (mockup 55 "Cơ hội nổi bật"). */
export function OppCard({
  o,
  saved,
  onToggleSave,
}: {
  o: Opportunity;
  saved?: boolean;
  onToggleSave?: () => void;
}) {
  const Icon = TYPE_ICON[o.type];
  const tier = o.provider ? TIER_LABEL[o.provider.verificationTier] : null;
  return (
    <div className="relative rounded-[var(--radius-card)] border border-line bg-surface shadow-card">
      <Link href={`/opportunities/${o.id}`} className="pressable flex gap-3 p-4 pr-14">
        <span className="grid size-12 shrink-0 place-items-center rounded-2xl bg-primary-soft text-primary">
          <Icon size={24} />
        </span>
        <span className="min-w-0 flex-1">
          <span className="line-clamp-2 text-[15px] leading-snug font-bold text-ink">{o.title}</span>
          {o.provider && (
            <span className="mt-0.5 flex items-center gap-1 text-[13px] text-ink-2">
              <span className="truncate">{o.provider.displayName}</span>
              {tier && <BadgeCheck size={15} className="shrink-0 text-primary" aria-label={tier} />}
            </span>
          )}
          <span className="mt-2 flex flex-wrap gap-1.5">
            <Badge>{TYPE_LABEL[o.type]}</Badge>
            {o.locationText && (
              <span className="inline-flex items-center gap-1 text-[12px] text-muted">
                <MapPin size={13} /> {o.locationText}
              </span>
            )}
          </span>
          <span className="mt-2 flex items-center gap-1 text-[12px]">
            <Clock size={13} className="text-muted" /> <DeadlineText deadline={o.deadlineAt} />
          </span>
        </span>
      </Link>
      {onToggleSave && (
        <button
          type="button"
          onClick={onToggleSave}
          aria-label={saved ? "Bỏ lưu" : "Lưu cơ hội"}
          aria-pressed={saved}
          className={cx("pressable absolute top-3 right-3 grid size-10 place-items-center rounded-full", saved ? "text-primary" : "text-muted")}
        >
          {saved ? <BookmarkCheck size={22} /> : <Bookmark size={22} />}
        </button>
      )}
    </div>
  );
}

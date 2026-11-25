import Link from "next/link";
import { BookOpen, Clock, GraduationCap, Users } from "lucide-react";
import { Badge } from "@/ui";
import { ProgressBar } from "@/ui/ProgressBar";
import { LEVEL_LABEL, TOPIC_LABEL } from "../domain/learning";
import type { CourseCard as Card } from "../server/service";

export function CourseCard({ c, progressPct }: { c: Card; progressPct?: number }) {
  const Icon = c.topic === "finance" ? GraduationCap : BookOpen;
  return (
    <Link href={`/learn/courses/${c.id}`} className="pressable flex gap-3 rounded-[var(--radius-card)] border border-line bg-surface p-3.5 shadow-card">
      <span className={`grid size-16 shrink-0 place-items-center rounded-2xl ${c.topic === "finance" ? "bg-income-soft text-income" : "bg-primary-soft text-primary"}`}>
        <Icon size={28} />
      </span>
      <span className="min-w-0 flex-1">
        <span className="line-clamp-2 text-[15px] leading-snug font-bold text-ink">{c.title}</span>
        <span className="mt-1 flex flex-wrap gap-1.5">
          <Badge tone="muted">{TOPIC_LABEL[c.topic]}</Badge>
          <Badge tone="muted">{LEVEL_LABEL[c.level]}</Badge>
        </span>
        <span className="mt-1.5 flex items-center gap-3 text-[12px] text-muted">
          <span className="flex items-center gap-1">
            <BookOpen size={13} /> {c.lessonCount} bài
          </span>
          <span className="flex items-center gap-1">
            <Clock size={13} /> {c.durationMin} phút
          </span>
          <span className="flex items-center gap-1">
            <Users size={13} /> {c.learners}
          </span>
        </span>
        {progressPct !== undefined && <ProgressBar className="mt-2" value={progressPct} label={`Tiến độ ${progressPct}%`} />}
      </span>
    </Link>
  );
}

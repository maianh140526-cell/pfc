"use client";

import Link from "next/link";
import { Briefcase, Clock, GraduationCap, MapPin, Trophy } from "lucide-react";
import { useState } from "react";
import { Badge } from "@/ui";
import { EXT_TYPE_LABEL, type ExtType } from "../domain/feed";
import type { ExtOpportunity } from "../server/service";

const ICON: Record<ExtType, typeof Briefcase> = { internship: GraduationCap, job: Briefcase, competition: Trophy, scholarship: GraduationCap };

/** Cover image from the posting's own site (or a PFC upload); falls back to the type icon when it cannot load. */
export function OppThumb({ type, src, size = "sm" }: { type: ExtType; src: string; size?: "sm" | "lg" }) {
  const [failed, setFailed] = useState(false);
  const Icon = ICON[type];
  const box = size === "lg" ? "aspect-[16/9] w-full rounded-2xl" : "size-16 rounded-2xl";
  return (
    <span className={`relative grid shrink-0 place-items-center overflow-hidden bg-primary-soft text-primary ${box}`}>
      {src && !failed ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={src} alt="" loading="lazy" referrerPolicy="no-referrer" onError={() => setFailed(true)} className="size-full object-cover" />
      ) : (
        <Icon size={size === "lg" ? 40 : 26} />
      )}
    </span>
  );
}

const fmt = (iso: string | null) => (iso ? new Date(iso).toLocaleDateString("vi-VN", { timeZone: "Asia/Ho_Chi_Minh" }) : "");

/** List card: image, title, organisation, place, live status (còn N ngày / đã đóng) and where it comes from. */
export function ExtCard({ o }: { o: ExtOpportunity }) {
  return (
    <Link href={`/opportunities/sources/${o.id}`} className="pressable flex gap-3 rounded-[var(--radius-card)] border border-line bg-surface p-3 shadow-card">
      <OppThumb type={o.type} src={o.imageUrl} />
      <span className="min-w-0 flex-1">
        <span className="line-clamp-2 text-[15px] leading-snug font-bold text-ink">{o.title}</span>
        {o.organization && <span className="mt-0.5 block truncate text-[13px] text-ink-2">{o.organization}</span>}
        <span className="mt-1.5 flex flex-wrap items-center gap-1.5">
          <Badge>{EXT_TYPE_LABEL[o.type]}</Badge>
          <Badge tone={o.state.tone}>{o.state.label}</Badge>
          {o.location && (
            <span className="inline-flex items-center gap-1 text-[12px] text-muted">
              <MapPin size={12} /> <span className="max-w-40 truncate">{o.location}</span>
            </span>
          )}
        </span>
        <span className="mt-1 flex items-center gap-1 text-[12px] text-muted">
          <Clock size={12} /> {o.deadlineAt ? `Hạn ${fmt(o.deadlineAt)}` : o.postedAt ? `Đăng ${fmt(o.postedAt)}` : "Đang mở"} · {o.sourceLabel}
        </span>
      </span>
    </Link>
  );
}

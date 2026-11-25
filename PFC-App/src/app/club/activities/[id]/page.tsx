"use client";

import { useParams } from "next/navigation";
import { CalendarDays, CheckCircle2, MapPin, Monitor, Users } from "lucide-react";
import { useState } from "react";
import { useHub } from "@/platform/hub-proxy/client";
import { HubErrorState, ListSkeleton } from "@/platform/hub-proxy/HubStates";
import { CLUB_RUN_HINT, clubPost, useClub } from "@/modules/club/session";
import { fmtDateTime, type Activity } from "@/modules/club/types";
import { AppHeader, Badge, Button, ButtonLink, Section } from "@/ui";
import { FormError } from "@/ui/Form";

const STATUS_LABEL: Record<string, string> = { draft: "Bản nháp", active: "Đang mở", completed: "Đã kết thúc", archived: "Lưu trữ" };
const NEXT: Record<string, string[]> = { draft: ["active", "archived"], active: ["completed", "archived"], completed: ["archived"] };
const TO_LABEL: Record<string, string> = { active: "Công bố", completed: "Đánh dấu đã kết thúc", archived: "Lưu trữ" };

type ActivityDetail = Activity & { bodyMd?: string; joined?: boolean; myParticipation?: unknown };

/** Activity detail + join (FR-CLB-007 member participation). */
export default function ClubActivityPage() {
  const { id } = useParams<{ id: string }>();
  const { data, error, loading, reload } = useHub<{ activity: ActivityDetail }>("club", `?action=activity&activityId=${encodeURIComponent(id)}`);
  const { can, reload: reloadClub } = useClub();
  const canManage = can("manage_activities");
  const [state, setState] = useState<{ pending?: boolean; error?: string; joined?: boolean }>({});

  if (loading && !data) return <ListSkeleton rows={2} />;
  if (error || !data) {
    return (
      <>
        <AppHeader back backFallback="/club/activities" title="Hoạt động" />
        {error && <HubErrorState error={error} onRetry={reload} hubName="Câu lạc bộ" runHint={CLUB_RUN_HINT} />}
      </>
    );
  }
  const a = data.activity;
  const photos = [...new Set([...(a.coverUrl ? [a.coverUrl] : []), ...(a.mediaUrls ?? [])])];
  const joined = state.joined || a.joined || !!a.myParticipation;
  const modeLabel = a.mode === "online" ? "Trực tuyến" : a.mode === "hybrid" ? "Kết hợp" : "Trực tiếp";

  return (
    <>
      <AppHeader back backFallback="/club/activities" title="Hoạt động" />
      {photos.length > 0 && (
        <div className="px-4 pb-3">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={photos[0]} alt={`Ảnh bìa ${a.title}`} className="aspect-[16/9] w-full rounded-[var(--radius-card)] object-cover" />
        </div>
      )}
      <div className="px-4">
        {a.status !== "active" && <Badge tone={a.status === "draft" ? "muted" : "primary"}>{STATUS_LABEL[a.status] ?? a.status}</Badge>}
        <h1 className="mt-1 text-[22px] leading-tight font-extrabold text-ink">{a.title}</h1>
        <ul className="mt-3 space-y-1.5 text-[14px] text-ink-2">
          <li className="flex items-center gap-2">
            <CalendarDays size={16} className="text-muted" /> {a.startsAt ? fmtDateTime(a.startsAt) : "Chưa có lịch"}
            {a.endsAt ? ` – ${fmtDateTime(a.endsAt)}` : ""}
          </li>
          <li className="flex items-center gap-2">
            <Monitor size={16} className="text-muted" /> {modeLabel}
          </li>
          {a.location && (
            <li className="flex items-center gap-2">
              <MapPin size={16} className="text-muted" /> {a.location}
            </li>
          )}
          {a.participantCount != null && (
            <li className="flex items-center gap-2">
              <Users size={16} className="text-muted" /> {a.participantCount}
              {a.capacity ? `/${a.capacity}` : ""} người tham gia
            </li>
          )}
        </ul>
      </div>
      {a.description && a.bodyMd && a.bodyMd !== a.description && <p className="px-4 pt-3 text-[15px] font-semibold text-ink-2">{a.description}</p>}
      {(a.description || a.bodyMd) && (
        <Section title="Thông tin chi tiết">
          <p className="text-[15px] leading-relaxed whitespace-pre-line text-ink-2">{a.bodyMd || a.description}</p>
        </Section>
      )}
      {photos.length > 1 && (
        <Section title={`Ảnh (${photos.length - 1})`}>
          <ul className="grid grid-cols-3 gap-2">
            {photos.slice(1).map((u, i) => (
              <li key={u}>
                <a href={u} target="_blank" rel="noopener noreferrer">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={u} alt={`Ảnh ${i + 1} — ${a.title}`} className="aspect-square w-full rounded-xl object-cover" loading="lazy" />
                </a>
              </li>
            ))}
          </ul>
        </Section>
      )}
      {canManage && (
        <Section title="Quản lý hoạt động">
          <div className="flex flex-wrap gap-2">
            {a.status !== "archived" && (
              <ButtonLink href={`/club/activities/${a.id}/edit`} variant="secondary">
                Sửa
              </ButtonLink>
            )}
            {(NEXT[a.status] ?? []).map((to) => (
              <Button
                key={to}
                variant={to === "archived" ? "ghost" : "primary"}
                disabled={state.pending}
                onClick={async () => {
                  setState({ pending: true });
                  try {
                    await clubPost("activity_transition", { activityId: a.id, to });
                    setState({});
                    await Promise.all([reload(), reloadClub()]);
                  } catch (e) {
                    setState({ error: e instanceof Error ? e.message : "Thao tác thất bại." });
                  }
                }}
              >
                {TO_LABEL[to] ?? to}
              </Button>
            ))}
          </div>
        </Section>
      )}
      {a.status === "active" && (
        <Section>
          {joined ? (
            <p className="flex items-center justify-center gap-2 rounded-[var(--radius-control)] bg-income-soft py-3 text-[15px] font-semibold text-income">
              <CheckCircle2 size={20} /> Bạn đã tham gia
            </p>
          ) : (
            <Button
              block
              disabled={state.pending}
              onClick={async () => {
                setState({ pending: true });
                try {
                  await clubPost("join_activity", { activityId: a.id });
                  setState({ joined: true });
                  await reload();
                } catch (e) {
                  setState({ error: e instanceof Error ? e.message : "Tham gia thất bại." });
                }
              }}
            >
              {state.pending ? "Đang đăng ký…" : "Tham gia hoạt động"}
            </Button>
          )}
          <div className="mt-2">
            <FormError message={state.error} />
          </div>
        </Section>
      )}
    </>
  );
}

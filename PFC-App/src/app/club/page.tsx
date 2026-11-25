"use client";

import Link from "next/link";
import { Bell, CalendarDays, ClipboardCheck, KanbanSquare, Users } from "lucide-react";
import { allTasks, useClub } from "@/modules/club/session";
import { POSITION_LABEL, fmtDateTime, toDate } from "@/modules/club/types";
import { TaskCard } from "@/modules/club/ui/TaskCard";
import { AppHeader, Badge, Card, HeaderIconButton, Section } from "@/ui";

/** COM-12 Club Detail / COM-A02 Club Management overview (mockups 107, 117). */
export default function ClubOverviewPage() {
  const { home, can } = useClub();
  const myTasks = allTasks(home).filter((t) => t.assigneeId === home.user.id && t.status !== "done" && t.status !== "cancelled");
  const unread = home.notifications.filter((n) => n.unread).length;
  const pendingCount = (home.approvalQueue?.memberships.length ?? 0) + (home.approvalQueue?.taskReviews.length ?? 0);
  const upcoming = home.activities
    .filter((a) => a.status === "active" || a.status === "draft")
    .sort((a, b) => (toDate(a.startsAt)?.getTime() ?? Infinity) - (toDate(b.startsAt)?.getTime() ?? Infinity))
    .slice(0, 3);
  const r = home.report;

  const stats = [
    { label: "Thành viên", value: r?.members.active ?? home.members.filter((m) => m.status === "active").length, icon: Users, href: "/club/members" },
    { label: "Công việc", value: r?.tasks.total ?? allTasks(home).length, icon: KanbanSquare, href: "/club/tasks" },
    { label: "Hoạt động", value: r?.activities ?? home.activities.length, icon: CalendarDays, href: "/club/activities" },
    { label: "Sự kiện", value: r?.linkedEvents ?? home.links.length, icon: CalendarDays, href: "/club/activities?tab=events" },
  ];

  return (
    <>
      <AppHeader
        backHref="/home"
        title={home.club.name}
        actions={
          <HeaderIconButton label={`Thông báo${unread ? ` (${unread} chưa đọc)` : ""}`} href="/club/notifications">
            <span className="relative">
              <Bell size={22} />
              {unread > 0 && <span className="absolute -top-1 -right-1 size-2.5 rounded-full bg-expense" />}
            </span>
          </HeaderIconButton>
        }
      />
      <div className="px-4">
        <div className="rounded-[var(--radius-card)] bg-primary p-5 text-on-primary shadow-sheet">
          <p className="text-[13px] opacity-90">Xin chào, {home.user.fullName}</p>
          <p className="mt-1 text-[18px] font-extrabold">{home.myMembership ? POSITION_LABEL[home.myMembership.position] : "Khách"}</p>
          <p className="mt-1 line-clamp-2 text-[13px] opacity-90">{home.club.description}</p>
        </div>
      </div>

      <Section>
        <ul className="grid grid-cols-4 gap-2">
          {stats.map(({ label, value, icon: Icon, href }) => (
            <li key={label}>
              <Link href={href} className="pressable flex flex-col items-center rounded-2xl border border-line bg-surface py-3">
                <Icon size={18} className="text-primary" />
                <span className="mt-1 text-[18px] font-extrabold text-ink">{value}</span>
                <span className="text-[11px] text-muted">{label}</span>
              </Link>
            </li>
          ))}
        </ul>
      </Section>

      {(can("approve_memberships") || can("review_tasks")) && pendingCount > 0 && (
        <Section>
          <Link href="/club/manage/queue" className="pressable block">
            <Card className="flex items-center gap-3 border-warning bg-warning-soft">
              <ClipboardCheck size={24} className="text-warning" />
              <span className="flex-1 text-[15px] font-semibold text-ink">{pendingCount} mục đang chờ bạn duyệt</span>
              <Badge tone="warning">Xem</Badge>
            </Card>
          </Link>
        </Section>
      )}

      <Section
        title="Việc của tôi"
        action={
          <Link href="/club/tasks?mine=1" className="text-[14px] font-semibold text-primary">
            Xem tất cả
          </Link>
        }
      >
        {myTasks.length === 0 ? (
          <Card className="text-center text-[14px] text-muted">Bạn không có công việc đang mở.</Card>
        ) : (
          <div className="space-y-3">
            {myTasks.slice(0, 3).map((t) => (
              <TaskCard key={t.id} t={t} />
            ))}
          </div>
        )}
      </Section>

      <Section
        title="Hoạt động sắp tới"
        action={
          <Link href="/club/activities" className="text-[14px] font-semibold text-primary">
            Xem tất cả
          </Link>
        }
      >
        {upcoming.length === 0 ? (
          <Card className="text-center text-[14px] text-muted">Chưa có hoạt động nào.</Card>
        ) : (
          <ul className="space-y-2">
            {upcoming.map((a) => (
              <li key={a.id}>
                <Link href={`/club/activities/${a.id}`} className="pressable flex items-center gap-3 rounded-2xl border border-line bg-surface p-3">
                  <span className="grid size-11 place-items-center rounded-xl bg-primary-soft text-primary">
                    <CalendarDays size={20} />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-[15px] font-semibold text-ink">{a.title}</span>
                    <span className="block text-[12px] text-muted">{a.startsAt ? fmtDateTime(a.startsAt) : "Chưa có lịch"}</span>
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </Section>
    </>
  );
}

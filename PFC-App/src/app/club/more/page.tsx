"use client";

import { Bell, ChartColumn, ClipboardCheck, FileText, Network } from "lucide-react";
import { useClub } from "@/modules/club/session";
import { POSITION_LABEL } from "@/modules/club/types";
import { Avatar } from "@/modules/club/ui/Avatar";
import { AppHeader, Badge, ListGroup, ListItem, Section } from "@/ui";

/** Club "Thêm": personal + management entry points, shown by permission (deny by default). */
export default function ClubMorePage() {
  const { home, can } = useClub();
  const unread = home.notifications.filter((n) => n.unread).length;
  const pending = (home.approvalQueue?.memberships.length ?? 0) + (home.approvalQueue?.taskReviews.length ?? 0);
  const canQueue = can("approve_memberships") || can("review_tasks");

  return (
    <>
      <AppHeader title="Thêm" backHref="/club" />
      <Section>
        <div className="flex items-center gap-3 rounded-[var(--radius-card)] border border-line bg-surface p-4">
          <Avatar name={home.user.fullName} size={52} />
          <div className="min-w-0">
            <p className="truncate text-[16px] font-bold text-ink">{home.user.fullName}</p>
            <p className="truncate text-[13px] text-muted">{home.user.email}</p>
            {home.myMembership && <p className="text-[12px] font-semibold text-primary">{POSITION_LABEL[home.myMembership.position]}</p>}
          </div>
        </div>
      </Section>
      <Section>
        <ListGroup label="Của tôi">
          <ListItem icon={Bell} title="Thông báo CLB" href="/club/notifications" trailing={unread > 0 ? <Badge tone="expense">{unread}</Badge> : undefined} />
          <ListItem icon={FileText} title="Tài liệu nội bộ" description={`${home.documents.length} tài liệu`} href="/club/documents" />
        </ListGroup>
      </Section>
      {(canQueue || can("manage_members") || can("view_reports")) && (
        <Section>
          <ListGroup label="Quản lý">
            {canQueue && (
              <ListItem icon={ClipboardCheck} title="Hàng chờ duyệt" description="Thành viên mới, công việc chờ duyệt" href="/club/manage/queue" trailing={pending > 0 ? <Badge tone="warning">{pending}</Badge> : undefined} />
            )}
            {can("manage_members") && <ListItem icon={Network} title="Ban & đội nhóm" description={`${home.teams.length} ban`} href="/club/manage/teams" />}
            {can("view_reports") && <ListItem icon={ChartColumn} title="Báo cáo CLB" href="/club/report" />}
          </ListGroup>
        </Section>
      )}
      <Section>
        <p className="text-center text-[12px] text-muted">Bạn đang dùng tài khoản PFC. Đăng xuất ở mục Thêm của trang chủ PFC.</p>
      </Section>
    </>
  );
}

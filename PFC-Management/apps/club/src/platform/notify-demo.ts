import { nanoid } from "nanoid";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { members, notifications } from "@/db/schema";

/** Idempotent demo inbox for Notifications UI. */
export function ensureDemoNotifications(clubId: string): void {
  const marker = db
    .select()
    .from(notifications)
    .where(eq(notifications.id, "pm-demo-notify-01"))
    .all()[0];
  if (marker) return;

  const recipient =
    db
      .select()
      .from(members)
      .where(eq(members.email, "leader@pfc.vn"))
      .all()[0] ??
    db.select().from(members).all()[0];
  if (!recipient) return;

  const now = Date.now();
  const samples: Array<{
    id: string;
    type: string;
    title: string;
    body: string;
    scope: "club" | "team" | "personal";
    minutesAgo: number;
    unread: boolean;
  }> = [
    {
      id: "pm-demo-notify-01",
      type: "activity.updated",
      title: "Họp toàn CLB thứ Sáu",
      body: "18:30 tại phòng B1 — chuẩn bị báo cáo tháng.",
      scope: "club",
      minutesAgo: 10,
      unread: true,
    },
    {
      id: "pm-demo-notify-02",
      type: "document.shared",
      title: "Playbook vận hành đã cập nhật",
      body: "Mục Task + Event link theo ADR-008.",
      scope: "club",
      minutesAgo: 95,
      unread: true,
    },
    {
      id: "pm-demo-notify-03",
      type: "membership.role_changed",
      title: "Ban Truyền thông — briefing cover",
      body: "Deadline cover Canva trước 17:00 hôm nay.",
      scope: "team",
      minutesAgo: 45,
      unread: true,
    },
    {
      id: "pm-demo-notify-04",
      type: "task.assigned",
      title: "Bạn được giao: Cover series tháng 10",
      body: "Sub-task trong dự án Ví tiền sinh viên.",
      scope: "personal",
      minutesAgo: 25,
      unread: true,
    },
    {
      id: "pm-demo-notify-05",
      type: "task.deadline_soon",
      title: "Deadline sắp tới: Poster Summit",
      body: "Còn 2 ngày — nhớ nộp proof trước review.",
      scope: "personal",
      minutesAgo: 180,
      unread: false,
    },
    {
      id: "pm-demo-notify-06",
      type: "activity.updated",
      title: "Nội bộ Ban: lịch quay media",
      body: "Studio tầng 2 — mang thẻ thành viên.",
      scope: "team",
      minutesAgo: 400,
      unread: false,
    },
  ];

  for (const s of samples) {
    db.insert(notifications)
      .values({
        id: s.id,
        recipientId: recipient.id,
        clubId,
        type: s.type,
        title: s.title,
        body: s.body,
        payloadJson: JSON.stringify({ scope: s.scope, demo: true }),
        readAt: s.unread ? null : new Date(now - s.minutesAgo * 60_000),
        createdAt: new Date(now - s.minutesAgo * 60_000),
      })
      .run();
  }

  // Also seed a couple for member@ if present
  const member = db
    .select()
    .from(members)
    .where(eq(members.email, "member@pfc.vn"))
    .all()[0];
  if (member) {
    db.insert(notifications)
      .values({
        id: nanoid(),
        recipientId: member.id,
        clubId,
        type: "task.assigned",
        title: "Task mới được giao cho bạn",
        body: "Checklist workshop Budgeting 101.",
        payloadJson: JSON.stringify({ scope: "personal" }),
        createdAt: new Date(now - 20 * 60_000),
      })
      .run();
  }
}

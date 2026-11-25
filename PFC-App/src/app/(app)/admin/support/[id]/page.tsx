import Link from "next/link";
import { notFound } from "next/navigation";
import { requireMember, toActor } from "@/platform/auth/session";
import { SUPPORT_CATEGORIES, getTicket } from "@/platform/admin/console";
import { can } from "@/platform/roles";
import { TicketThread } from "@/modules/support/ui/TicketThread";
import { AppHeader, Section } from "@/ui";

export const metadata = { title: "Yêu cầu hỗ trợ" };
export const dynamic = "force-dynamic";

export default async function StaffTicketPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const me = await requireMember(`/admin/support/${id}`);
  const actor = toActor(me);
  if (!can(actor, "admin.support")) notFound();
  const t = await getTicket(actor, id);
  if (!t) notFound();
  return (
    <>
      <AppHeader back backFallback="/admin/support" title={t.subject} subtitle={SUPPORT_CATEGORIES[t.category]} />
      <div className="px-4 text-[13px] text-muted">
        Từ{" "}
        <Link href={`/admin/members/${t.memberId}`} className="font-semibold text-ink">
          {t.memberName}
        </Link>
      </div>
      <Section>
        <TicketThread id={t.id} messages={t.messages} closed={t.status === "closed"} viewerIsStaff />
        <div className="h-6" />
      </Section>
    </>
  );
}

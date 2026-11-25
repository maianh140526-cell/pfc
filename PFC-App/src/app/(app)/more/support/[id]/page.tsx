import { notFound } from "next/navigation";
import { requireMember, toActor } from "@/platform/auth/session";
import { SUPPORT_CATEGORIES, getTicket } from "@/platform/admin/console";
import { TicketThread } from "@/modules/support/ui/TicketThread";
import { AppHeader, Section } from "@/ui";

export const metadata = { title: "Yêu cầu hỗ trợ" };
export const dynamic = "force-dynamic";

export default async function MyTicketPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const me = await requireMember(`/more/support/${id}`);
  const t = await getTicket(toActor(me), id);
  if (!t || t.memberId !== me.id) notFound();
  return (
    <>
      <AppHeader back backFallback="/more/support" title={t.subject} subtitle={SUPPORT_CATEGORIES[t.category]} />
      <Section>
        <TicketThread id={t.id} messages={t.messages} closed={t.status === "closed"} viewerIsStaff={false} />
        <div className="h-6" />
      </Section>
    </>
  );
}

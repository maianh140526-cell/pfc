import { notFound } from "next/navigation";
import { LifeBuoy } from "lucide-react";
import { requireMember, toActor } from "@/platform/auth/session";
import { ticketInbox } from "@/platform/admin/console";
import { can } from "@/platform/roles";
import { TicketList } from "@/modules/support/ui/TicketList";
import { AppHeader, EmptyState, Section } from "@/ui";
import { FilterChips } from "@/ui/FilterChips";

export const metadata = { title: "Hỗ trợ thành viên" };
export const dynamic = "force-dynamic";

/** ADM support desk. */
export default async function SupportInbox({ searchParams }: { searchParams: Promise<{ status?: string }> }) {
  const { status } = await searchParams;
  const me = await requireMember("/admin/support");
  const actor = toActor(me);
  if (!can(actor, "admin.support")) notFound();
  const list = await ticketInbox(actor, status);
  return (
    <>
      <AppHeader back backFallback="/admin" title="Hỗ trợ thành viên" />
      <div className="px-4">
        <FilterChips
          label="Trạng thái"
          value={status ?? ""}
          hrefFor={(v) => (v ? `/admin/support?status=${v}` : "/admin/support")}
          options={[
            { value: "", label: "Chưa đóng" },
            { value: "open", label: "Đang chờ" },
            { value: "answered", label: "Đã trả lời" },
            { value: "closed", label: "Đã đóng" },
          ]}
        />
      </div>
      {list.length === 0 ? (
        <EmptyState icon={LifeBuoy} title="Không có yêu cầu" />
      ) : (
        <Section>
          <TicketList items={list} base="/admin/support" showMember />
        </Section>
      )}
    </>
  );
}

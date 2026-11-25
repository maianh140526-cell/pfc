import { LifeBuoy } from "lucide-react";
import { requireMember, toActor } from "@/platform/auth/session";
import { myTickets } from "@/platform/admin/console";
import { TicketList } from "@/modules/support/ui/TicketList";
import { AppHeader, ButtonLink, EmptyState, Section } from "@/ui";

export const metadata = { title: "Hỗ trợ" };
export const dynamic = "force-dynamic";

/** SYS help: my support requests. */
export default async function MySupportPage() {
  const me = await requireMember("/more/support");
  const list = await myTickets(toActor(me));
  return (
    <>
      <AppHeader back backFallback="/more/help" title="Yêu cầu hỗ trợ" />
      {list.length === 0 ? (
        <EmptyState icon={LifeBuoy} title="Bạn chưa gửi yêu cầu nào" description="Gặp vấn đề với tài khoản, thanh toán hay đơn hàng? Gửi cho Ban điều hành PFC." action={<ButtonLink href="/more/support/new" block>Gửi yêu cầu</ButtonLink>} />
      ) : (
        <Section>
          <TicketList items={list} base="/more/support" />
          <div className="mt-3 pb-6">
            <ButtonLink href="/more/support/new" block>
              Gửi yêu cầu mới
            </ButtonLink>
          </div>
        </Section>
      )}
    </>
  );
}

import { requireMember } from "@/platform/auth/session";
import { SUPPORT_CATEGORIES } from "@/platform/admin/console";
import { AppHeader } from "@/ui";
import { NewTicket } from "./NewTicket";

export const metadata = { title: "Gửi yêu cầu hỗ trợ" };

export default async function NewTicketPage() {
  await requireMember("/more/support/new");
  return (
    <>
      <AppHeader back backFallback="/more/support" title="Gửi yêu cầu hỗ trợ" />
      <NewTicket categories={Object.entries(SUPPORT_CATEGORIES)} />
    </>
  );
}

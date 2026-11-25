import { requireMember } from "@/platform/auth/session";
import { HoldingForm } from "@/modules/finance/ui/HoldingForm";
import { AppHeader } from "@/ui";

export const metadata = { title: "Thêm tài sản" };

export default async function NewHoldingPage() {
  await requireMember("/finance/invest/new");
  return (
    <>
      <AppHeader back backFallback="/finance/invest" title="Thêm tài sản" />
      <HoldingForm />
    </>
  );
}

import { requireMember } from "@/platform/auth/session";
import { GroupForm } from "@/modules/community/ui/GroupForm";
import { AppHeader } from "@/ui";

export const metadata = { title: "Tạo nhóm" };
export const dynamic = "force-dynamic";

/** COM-14 Create Club/Group. */
export default async function NewGroupPage() {
  await requireMember("/community/groups/new");
  return (
    <>
      <AppHeader back backFallback="/community/groups" title="Tạo nhóm" />
      <GroupForm />
    </>
  );
}

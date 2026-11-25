import { ShieldAlert } from "lucide-react";
import { requireMember, toActor } from "@/platform/auth/session";
import { listMembers } from "@/platform/admin/service";
import { can } from "@/platform/roles";
import { AppHeader, EmptyState } from "@/ui";
import { MemberAdmin } from "./MemberAdmin";

export const metadata = { title: "Quản lý tài khoản" };

/** IAM-A01 User Management. Viewing: Chủ nhiệm + Ban điều hành; changing: Chủ nhiệm only (enforced in service). */
export default async function AdminPage({ searchParams }: { searchParams: Promise<{ q?: string }> }) {
  const me = await requireMember("/more/admin");
  const actor = toActor(me);
  if (!can(actor, "admin.members.view")) {
    return (
      <>
        <AppHeader back backFallback="/more" title="Quản lý tài khoản" />
        <EmptyState icon={ShieldAlert} title="Không có quyền" description="Chỉ Chủ nhiệm và Ban điều hành xem được danh sách tài khoản." />
      </>
    );
  }
  const { q } = await searchParams;
  const members = await listMembers(actor, q?.slice(0, 60));
  return (
    <>
      <AppHeader back backFallback="/more" title="Quản lý tài khoản" />
      <MemberAdmin members={members} meId={me.id} canEdit={can(actor, "admin.roles.manage")} canLock={can(actor, "admin.members.lock")} />
    </>
  );
}

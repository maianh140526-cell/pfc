import { notFound } from "next/navigation";
import { requireMember, toActor } from "@/platform/auth/session";
import { campaigns } from "@/platform/admin/console";
import { DEPARTMENT_LABEL, ROLE_LABEL, can } from "@/platform/roles";
import { AppHeader, Section } from "@/ui";
import { BroadcastForm } from "./BroadcastForm";

export const metadata = { title: "Gửi thông báo chung" };
export const dynamic = "force-dynamic";

/** NOT-A01…A03 Announcements to all members or by role / department. */
export default async function BroadcastPage() {
  const me = await requireMember("/admin/broadcast");
  const actor = toActor(me);
  if (!can(actor, "admin.broadcast")) notFound();
  const list = await campaigns(actor);
  return (
    <>
      <AppHeader back backFallback="/admin" title="Gửi thông báo chung" />
      <Section>
        <BroadcastForm roles={Object.entries(ROLE_LABEL)} departments={Object.entries(DEPARTMENT_LABEL)} />
      </Section>
      <Section title="Đã gửi">
        {list.length === 0 ? (
          <p className="text-[14px] text-muted">Chưa gửi thông báo nào.</p>
        ) : (
          <ul className="space-y-2 pb-6">
            {list.map((c) => (
              <li key={c.id} className="rounded-xl border border-line bg-surface px-4 py-3">
                <p className="text-[14px] font-semibold text-ink">{c.title}</p>
                {c.body && <p className="text-[13px] text-ink-2">{c.body}</p>}
                <p className="text-[12px] text-muted">
                  {c.recipients} người · {c.by} · {c.sentAt && new Date(c.sentAt).toLocaleString("vi-VN", { timeZone: "Asia/Ho_Chi_Minh" })}
                  {(c.audience.roles.length > 0 || c.audience.departments.length > 0) &&
                    ` · ${[...c.audience.roles.map((r) => ROLE_LABEL[r]), ...c.audience.departments.map((d) => DEPARTMENT_LABEL[d])].join(", ")}`}
                </p>
              </li>
            ))}
          </ul>
        )}
      </Section>
    </>
  );
}

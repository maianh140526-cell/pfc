import Link from "next/link";
import { notFound } from "next/navigation";
import { requireMember, toActor } from "@/platform/auth/session";
import { auditLog } from "@/platform/admin/console";
import { can } from "@/platform/roles";
import { AppHeader, Badge, EmptyState } from "@/ui";
import { FilterChips } from "@/ui/FilterChips";
import { SearchBox } from "@/ui/SearchBox";
import { ScrollText } from "lucide-react";

export const metadata = { title: "Nhật ký hệ thống" };
export const dynamic = "force-dynamic";

const VIEWS = { all: "Tất cả", security: "Bảo mật", data: "Yêu cầu dữ liệu", failure: "Thất bại" } as const;

/** ADM-08 Audit log, ADM-09 security events, ADM-10 personal-data requests (exports / deletions). */
export default async function AuditPage({ searchParams }: { searchParams: Promise<{ view?: string; q?: string }> }) {
  const sp = await searchParams;
  const me = await requireMember("/admin/audit");
  const actor = toActor(me);
  if (!can(actor, "admin.audit.view")) notFound();
  const view = sp.view && sp.view in VIEWS ? (sp.view as keyof typeof VIEWS) : "all";
  const rows = await auditLog(actor, { q: sp.q?.slice(0, 60), view: view === "failure" ? "all" : view, result: view === "failure" ? "failure" : undefined });
  return (
    <>
      <AppHeader back backFallback="/admin" title="Nhật ký hệ thống" />
      <div className="space-y-3 px-4">
        <SearchBox placeholder="Tìm thao tác, người, đối tượng…" />
        <FilterChips label="Loại" value={view} hrefFor={(v) => `/admin/audit?view=${v}${sp.q ? `&q=${encodeURIComponent(sp.q)}` : ""}`} options={Object.entries(VIEWS).map(([value, label]) => ({ value, label }))} />
      </div>
      {rows.length === 0 ? (
        <EmptyState icon={ScrollText} title="Không có bản ghi" />
      ) : (
        <ul className="mx-4 mt-3 mb-6 divide-y divide-line overflow-hidden rounded-[var(--radius-card)] border border-line bg-surface">
          {rows.map((r) => (
            <li key={r.id} className="px-4 py-2.5 text-[13px]">
              <p className="flex items-center justify-between gap-2">
                <span className="font-mono font-semibold break-all text-ink">{r.action}</span>
                {r.result === "failure" && <Badge tone="expense">Thất bại</Badge>}
              </p>
              <p className="text-muted">
                {r.actorId ? (
                  <Link href={`/admin/members/${r.actorId}`} className="font-semibold text-ink-2">
                    {r.actorName ?? r.actorId.slice(0, 8)}
                  </Link>
                ) : (
                  "Hệ thống"
                )}
                {r.objectRef && <span className="break-all"> · {r.objectRef}</span>} · {new Date(r.at).toLocaleString("vi-VN", { timeZone: "Asia/Ho_Chi_Minh" })}
              </p>
            </li>
          ))}
        </ul>
      )}
    </>
  );
}

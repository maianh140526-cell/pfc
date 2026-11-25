import { Check, X } from "lucide-react";
import { currentMember, toActor } from "@/platform/auth/session";
import { CLUB_MATRIX, PROJECT_MATRIX,DEPARTMENT_LABEL, PERMISSIONS, ROLE_LABEL, can, type Actor, type Permission } from "@/platform/roles";
import { AppHeader, Badge, Card, Section } from "@/ui";

export const metadata = { title: "Phân quyền" };

const COLUMNS: Array<{ label: string; actor: Actor }> = [
  { label: "Chủ nhiệm", actor: { id: "", role: "chu_nhiem", department: null } },
  { label: "Ban ĐH", actor: { id: "", role: "ban_dieu_hanh", department: null } },
  { label: "TB CM", actor: { id: "", role: "truong_ban", department: "chuyen_mon" } },
  { label: "TB TT", actor: { id: "", role: "truong_ban", department: "truyen_thong" } },
  { label: "TB SK", actor: { id: "", role: "truong_ban", department: "su_kien" } },
  { label: "TV", actor: { id: "", role: "thanh_vien", department: null } },
];

/** IAM-A05 Role-Permission Matrix (read-only for everyone; Chủ nhiệm edits roles in Quản lý tài khoản). */
export default async function RolesPage() {
  const me = await currentMember();
  const mine = me ? (Object.keys(PERMISSIONS) as Permission[]).filter((p) => can(toActor(me), p)) : [];

  return (
    <>
      <AppHeader back backFallback="/more" title="Phân quyền" />
      {me && (
        <Section>
          <Card>
            <p className="text-[13px] text-muted">Vai trò của bạn</p>
            <p className="text-[18px] font-extrabold text-ink">
              {ROLE_LABEL[me.role]}
              {me.department ? ` · ${DEPARTMENT_LABEL[me.department]}` : ""}
            </p>
            <p className="mt-2 text-[13px] text-ink-2">
              Mọi thành viên đều dùng được tất cả các nhánh và quản lý được nội dung <b>của chính mình</b>.
              {mine.length > 0 ? " Ngoài ra bạn được:" : " Bạn không có quyền thao tác trên nội dung hay tài khoản của người khác."}
            </p>
            {mine.length > 0 && (
              <ul className="mt-2 space-y-1 text-[13px] text-ink">
                {mine.map((p) => (
                  <li key={p} className="flex gap-2">
                    <Check size={16} className="mt-0.5 shrink-0 text-income" /> {PERMISSIONS[p]}
                  </li>
                ))}
              </ul>
            )}
          </Card>
        </Section>
      )}

      <Section title="Học tập · Marketplace · Dự án · Quản trị">
        <div className="overflow-x-auto rounded-[var(--radius-card)] border border-line bg-surface">
          <table className="w-full min-w-[560px] text-[12px]">
            <thead>
              <tr className="border-b border-line text-muted">
                <th className="px-3 py-2 text-left font-semibold">Quyền</th>
                {COLUMNS.map((c) => (
                  <th key={c.label} className="px-1 py-2 text-center font-semibold whitespace-nowrap">
                    {c.label}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {(Object.keys(PERMISSIONS) as Permission[]).map((p) => (
                <tr key={p} className="border-b border-line last:border-0">
                  <td className="px-3 py-2 text-ink-2">{PERMISSIONS[p]}</td>
                  {COLUMNS.map((c) => (
                    <td key={c.label} className="px-1 py-2 text-center">
                      {can(c.actor, p) ? (
                        <Check size={16} className="inline text-income" aria-label="Có" />
                      ) : (
                        <X size={16} className="inline text-muted" aria-label="Không" />
                      )}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="mt-2 text-[12px] text-muted">
          Ban ĐH = Ban điều hành · TB = Trưởng ban (CM Chuyên môn, TT Truyền thông, SK Sự kiện) · TV = Thành viên.
        </p>
      </Section>

      <Section title="Câu lạc bộ">
        <div className="space-y-3">
          {CLUB_MATRIX.map((r) => (
            <Card key={r.position} className="p-3.5">
              <Badge>{r.position}</Badge>
              <p className="mt-2 flex gap-2 text-[13px] text-ink">
                <Check size={16} className="mt-0.5 shrink-0 text-income" /> {r.can}
              </p>
              {r.cannot !== "—" && (
                <p className="mt-1 flex gap-2 text-[13px] text-ink-2">
                  <X size={16} className="mt-0.5 shrink-0 text-expense" /> {r.cannot}
                </p>
              )}
            </Card>
          ))}
        </div>
        <p className="mt-2 text-[12px] text-muted">Quyền trong CLB được máy chủ Câu lạc bộ kiểm tra theo vị trí của bạn trong CLB.</p>
      </Section>

      <Section title="Trong từng dự án">
        <div className="space-y-3">
          {PROJECT_MATRIX.map((r) => (
            <Card key={r.position} className="p-3.5">
              <Badge>{r.position}</Badge>
              <p className="mt-2 flex gap-2 text-[13px] text-ink">
                <Check size={16} className="mt-0.5 shrink-0 text-income" /> {r.can}
              </p>
              <p className="mt-1 flex gap-2 text-[13px] text-ink-2">
                <X size={16} className="mt-0.5 shrink-0 text-expense" /> {r.cannot}
              </p>
            </Card>
          ))}
        </div>
      </Section>
    </>
  );
}

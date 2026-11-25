"use client";

import { Lock } from "lucide-react";
import { useState } from "react";
import type { AdminMemberRow } from "@/platform/admin/service";
import { setLockedAction, setRoleAction } from "@/platform/admin/actions";
import { DEPARTMENTS, DEPARTMENT_LABEL, ROLES, ROLE_LABEL, type Department, type Role } from "@/platform/roles";
import { SearchBox } from "@/ui/SearchBox";
import { Badge, BottomSheet, Button, ButtonLink } from "@/ui";
import { FormError, SelectInput } from "@/ui/Form";
import { useAction } from "@/ui/use-action";

export function MemberAdmin({ members, meId, canEdit, canLock }: { members: AdminMemberRow[]; meId: string; canEdit: boolean; canLock: boolean }) {
  const [editing, setEditing] = useState<AdminMemberRow | null>(null);
  const [role, setRole] = useState<Role>("thanh_vien");
  const [dept, setDept] = useState<Department>("chuyen_mon");
  const save = useAction();
  const lock = useAction();

  function open(m: AdminMemberRow) {
    setEditing(m);
    setRole(m.role);
    setDept(m.department ?? "chuyen_mon");
    save.setError(null);
    lock.setError(null);
  }

  return (
    <div className="space-y-3 px-4">
      <SearchBox placeholder="Tìm theo tên hoặc email…" />
      {!canEdit && <p className="text-[13px] text-muted">Bạn chỉ xem được. Chủ nhiệm mới được đổi vai trò hoặc khóa tài khoản.</p>}
      <ul className="divide-y divide-line overflow-hidden rounded-[var(--radius-card)] border border-line bg-surface">
        {members.map((m) => (
          <li key={m.id}>
            <button type="button" onClick={() => open(m)} className="flex w-full items-center gap-3 px-4 py-3 text-left active:bg-surface-2">
              <span className="min-w-0 flex-1">
                <span className="flex items-center gap-1.5 text-[15px] font-semibold text-ink">
                  <span className="truncate">{m.fullName}</span>
                  {m.locked && <Lock size={14} className="shrink-0 text-expense" aria-label="Đã khóa" />}
                  {m.id === meId && <span className="text-[12px] font-normal text-muted">(bạn)</span>}
                </span>
                <span className="block truncate text-[12px] text-muted">{m.email}</span>
              </span>
              <Badge tone={m.role === "chu_nhiem" ? "expense" : m.role === "thanh_vien" ? "muted" : "primary"}>
                {ROLE_LABEL[m.role]}
                {m.department ? ` · ${DEPARTMENT_LABEL[m.department].replace("Ban ", "")}` : ""}
              </Badge>
            </button>
          </li>
        ))}
      </ul>

      <BottomSheet open={editing !== null} onClose={() => setEditing(null)} title={editing?.fullName ?? ""}>
        {editing && (
          <div className="space-y-4">
            <p className="text-[13px] text-muted">{editing.email}</p>
            <ButtonLink href={`/admin/members/${editing.id}`} variant="secondary" block>
              Chi tiết, hạn chế, điểm thưởng
            </ButtonLink>
            {canEdit && (
              <>
                <SelectInput label="Vai trò" value={role} onChange={(e) => setRole(e.target.value as Role)}>
                  {ROLES.map((r) => (
                    <option key={r} value={r}>
                      {ROLE_LABEL[r]}
                    </option>
                  ))}
                </SelectInput>
                {role === "truong_ban" && (
                  <SelectInput label="Ban phụ trách" value={dept} onChange={(e) => setDept(e.target.value as Department)}>
                    {DEPARTMENTS.map((d) => (
                      <option key={d} value={d}>
                        {DEPARTMENT_LABEL[d]}
                      </option>
                    ))}
                  </SelectInput>
                )}
                <FormError message={save.error} />
                <Button block disabled={save.pending} onClick={() => save.run(() => setRoleAction(editing.id, role, role === "truong_ban" ? dept : null), () => setEditing(null))}>
                  {save.pending ? "Đang lưu…" : "Lưu vai trò"}
                </Button>
              </>
            )}
            {canLock && editing.id !== meId && (
              <>
                <FormError message={lock.error} />
                <Button
                  variant={editing.locked ? "secondary" : "danger"}
                  block
                  disabled={lock.pending}
                  onClick={() => lock.run(() => setLockedAction(editing.id, !editing.locked), () => setEditing(null))}
                >
                  {editing.locked ? "Mở khóa tài khoản" : "Khóa tài khoản"}
                </Button>
              </>
            )}
          </div>
        )}
      </BottomSheet>
    </div>
  );
}

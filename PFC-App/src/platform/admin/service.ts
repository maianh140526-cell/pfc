import "server-only";
import { all, one, run } from "@/platform/db/client";
import { audit } from "@/platform/audit";
import { ActionError } from "@/platform/errors";
import { can, checkRoleChange, isDepartment, isRole, type Actor, type Department, type Role } from "@/platform/roles";

/** Platform account administration (ADM-05/07, IAM-A01…A05). Callers pass the verified actor. */
export type AdminMemberRow = {
  id: string;
  email: string;
  fullName: string;
  role: Role;
  department: Department | null;
  locked: boolean;
  createdAt: string;
};

export async function listMembers(actor: Actor, q?: string): Promise<AdminMemberRow[]> {
  if (!can(actor, "admin.members.view")) throw new ActionError("Bạn không có quyền xem danh sách tài khoản.");
  const like = q?.trim() ? `%${q.trim().replace(/[\\%_]/g, (m) => `\\${m}`)}%` : null;
  const rows = await all<{ id: string; email: string; full_name: string; role: string; department: string | null; locked: number; created_at: string }>(
    `SELECT id, email, full_name, role, department, locked, created_at FROM members
     ${like ? "WHERE email LIKE ? ESCAPE '\\' OR full_name LIKE ? ESCAPE '\\'" : ""}
     ORDER BY CASE role WHEN 'chu_nhiem' THEN 0 WHEN 'ban_dieu_hanh' THEN 1 WHEN 'truong_ban' THEN 2 ELSE 3 END, full_name
     LIMIT 500`,
    like ? [like, like] : [],
  );
  return rows.map((r) => ({
    id: r.id,
    email: r.email,
    fullName: r.full_name,
    role: isRole(r.role) ? r.role : "thanh_vien",
    department: isDepartment(r.department) ? r.department : null,
    locked: Number(r.locked) === 1,
    createdAt: r.created_at,
  }));
}

export async function setRole(actor: Actor, targetId: string, role: unknown, department: unknown): Promise<void> {
  if (!isRole(role)) throw new ActionError("Vai trò không hợp lệ.");
  if (role === "truong_ban" && !isDepartment(department)) throw new ActionError("Trưởng ban cần chọn ban phụ trách.");
  const dept: Department | null = role === "truong_ban" && isDepartment(department) ? department : null;
  const target = await one<{ role: string }>("SELECT role FROM members WHERE id = ?", [targetId]);
  if (!target) throw new ActionError("Không tìm thấy tài khoản.");
  const owners = await one<{ n: number }>("SELECT COUNT(*) AS n FROM members WHERE role = 'chu_nhiem' AND locked = 0");
  const err = checkRoleChange({
    actor,
    targetId,
    targetRole: isRole(target.role) ? target.role : "thanh_vien",
    newRole: role,
    ownerCount: Number(owners?.n ?? 0),
  });
  if (err) {
    await audit(actor.id, "admin.set_role", `member:${targetId}`, "failure");
    throw new ActionError(err);
  }
  await run("UPDATE members SET role = ?, department = ?, updated_at = ? WHERE id = ?", [role, dept, new Date().toISOString(), targetId]);
  await audit(actor.id, `admin.set_role:${role}`, `member:${targetId}`, "success");
}

export async function setLocked(actor: Actor, targetId: string, locked: boolean): Promise<void> {
  if (!can(actor, "admin.members.lock")) throw new ActionError("Chỉ Chủ nhiệm được khóa tài khoản.");
  if (targetId === actor.id) throw new ActionError("Không thể tự khóa tài khoản của mình.");
  const target = await one<{ role: string }>("SELECT role FROM members WHERE id = ?", [targetId]);
  if (!target) throw new ActionError("Không tìm thấy tài khoản.");
  if (locked && target.role === "chu_nhiem") throw new ActionError("Hãy đổi vai trò trước khi khóa một Chủ nhiệm.");
  await run("UPDATE members SET locked = ?, updated_at = ? WHERE id = ?", [locked ? 1 : 0, new Date().toISOString(), targetId]);
  await audit(actor.id, locked ? "admin.lock" : "admin.unlock", `member:${targetId}`, "success");
}

import { randomUUID } from "node:crypto";
import { run } from "@/platform/db/client";
import type { Actor, Department, Role } from "@/platform/roles";

/** Inserts a member row for service tests and returns it as an Actor. */
export async function makeMember(role: Role = "thanh_vien", department: Department | null = null, name = "Test"): Promise<Actor & { email: string }> {
  const id = randomUUID();
  const email = `${id.slice(0, 8)}@test.local`;
  const now = new Date().toISOString();
  await run(
    "INSERT INTO members (id, email, full_name, password_hash, role, department, created_at, updated_at) VALUES (?, ?, ?, '!', ?, ?, ?, ?)",
    [id, email, name, role, department, now, now],
  );
  return { id, role, department, email };
}

import { notFound } from "next/navigation";
import { requireMember, toActor } from "@/platform/auth/session";
import { can } from "@/platform/roles";

/** Signed-in leader (Ban điều hành / Trưởng ban / Chủ nhiệm) or a 404 — the service re-checks on every write. */
export async function requirePoster(next: string) {
  const me = await requireMember(next);
  const actor = toActor(me);
  if (!can(actor, "opp.post")) notFound();
  return actor;
}

import "server-only";
import { randomUUID } from "node:crypto";
import { run } from "@/platform/db/client";

/** FR-CORE-005 audit trail: actor, time, object, action, result. Never log secrets or amounts. */
export async function audit(
  actorId: string | null,
  action: string,
  objectRef: string | null,
  result: "success" | "failure",
): Promise<void> {
  await run(
    "INSERT INTO audit_log (id, actor_id, action, object_ref, result, created_at) VALUES (?, ?, ?, ?, ?, ?)",
    [randomUUID(), actorId, action, objectRef, result, new Date().toISOString()],
  );
}

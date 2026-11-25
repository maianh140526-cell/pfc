import "server-only";
import { ZodError } from "zod";
import { ActionError } from "@/platform/auth/session";

/** Uniform server-action result so forms can show errors without leaking internals. */
export type ActionResult<T = undefined> =
  | { ok: true; data: T }
  | { ok: false; error: string; code?: string; meta?: Record<string, string | number> };

export async function safeAction<T>(fn: () => Promise<T>): Promise<ActionResult<T>> {
  try {
    return { ok: true, data: await fn() };
  } catch (err) {
    if (err instanceof ActionError) return { ok: false, error: err.message, ...(err.code ? { code: err.code } : {}), ...(err.meta ? { meta: err.meta } : {}) };
    if (err instanceof ZodError) return { ok: false, error: err.issues[0]?.message ?? "Dữ liệu không hợp lệ." };
    // next/navigation redirect() throws a special error that must propagate.
    if (err && typeof err === "object" && "digest" in err && String((err as { digest: unknown }).digest).startsWith("NEXT_REDIRECT")) {
      throw err;
    }
    console.error("[action]", err);
    return { ok: false, error: "Đã có lỗi xảy ra. Vui lòng thử lại." };
  }
}

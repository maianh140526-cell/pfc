/**
 * Runs once per server start (Next.js instrumentation).
 * - Logs configuration problems by variable name (never values) so a bad deploy is obvious in the logs.
 * - Logs unhandled request errors as one JSON line (picked up by Vercel log drains / any log tool).
 */
export async function register() {
  if (process.env.NEXT_RUNTIME !== "nodejs") return;
  const { checkEnv } = await import("./platform/env");
  const r = checkEnv(process.env, process.env.NODE_ENV === "production" && process.env.PFC_ENV !== "local");
  for (const p of r.problems) console.error(`[config] ${p}`);
  for (const w of r.warnings) console.warn(`[config] ${w}`);
}

export async function onRequestError(
  err: unknown,
  request: { path: string; method: string },
  context: { routerKind: string; routePath: string; routeType: string },
) {
  const e = err as { message?: string; digest?: string; name?: string };
  console.error(
    JSON.stringify({
      level: "error",
      at: new Date().toISOString(),
      kind: "request_error",
      method: request.method,
      // Route pattern only (e.g. /market/orders/[id]): no ids, query strings or tokens in logs.
      route: context.routePath,
      routeType: context.routeType,
      name: e?.name,
      message: e?.message?.slice(0, 300),
      digest: e?.digest,
    }),
  );
}

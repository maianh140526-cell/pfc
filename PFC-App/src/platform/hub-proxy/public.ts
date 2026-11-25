import "server-only";
import { HUB_CONFIG } from "./config";

/**
 * Server-side reads of PUBLIC hub data (no member session): verified opportunities only.
 * Used by the landing page stats and global search. Short timeout; failure → null (the caller hides it).
 */
export type PublicOpportunity = { id: string; title: string; type: string; provider: string | null; deadlineAt: string | null };

export async function publicOpportunities(q = "", pageSize = 5): Promise<{ total: number; items: PublicOpportunity[] } | null> {
  try {
    const url = new URL("/api/opportunities", HUB_CONFIG.opp.origin());
    if (q.trim()) url.searchParams.set("q", q.trim().slice(0, 80));
    url.searchParams.set("pageSize", String(Math.min(Math.max(pageSize, 1), 50)));
    const res = await fetch(url, { cache: "no-store", signal: AbortSignal.timeout(3000), headers: { accept: "application/json" } });
    if (!res.ok) return null;
    const j = (await res.json()) as { total?: number; items?: { id: string; title: string; type: string; deadlineAt?: string | null; provider?: { displayName?: string } | null }[] };
    return {
      total: Number(j.total ?? 0),
      items: (j.items ?? []).map((o) => ({ id: o.id, title: o.title, type: o.type, provider: o.provider?.displayName ?? null, deadlineAt: o.deadlineAt ?? null })),
    };
  } catch {
    return null;
  }
}

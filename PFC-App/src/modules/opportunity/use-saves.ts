"use client";

import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { hubFetch } from "@/platform/hub-proxy/client";
import { useOppSession } from "./session";
import type { Opportunity } from "./types";

/** Saved-ids set with optimistic toggle (FR-OPP-003). Signed-out users are sent to sign in. */
export function useSaves() {
  const { user } = useOppSession();
  const router = useRouter();
  const [ids, setIds] = useState<Set<string>>(new Set());

  useEffect(() => {
    if (!user) return setIds(new Set());
    hubFetch<{ items: Array<{ opportunity: Opportunity }> }>("opp", "/me/saves")
      .then((r) => setIds(new Set(r.items.map((s) => s.opportunity.id))))
      .catch(() => undefined);
  }, [user]);

  const toggle = useCallback(
    async (id: string) => {
      if (!user) return router.push("/opportunities/account");
      const was = ids.has(id);
      setIds((s) => {
        const n = new Set(s);
        if (was) n.delete(id);
        else n.add(id);
        return n;
      });
      try {
        await hubFetch("opp", `/opportunities/${id}/save`, { method: was ? "DELETE" : "POST" });
      } catch {
        setIds((s) => {
          const n = new Set(s);
          if (was) n.add(id);
          else n.delete(id);
          return n;
        });
      }
    },
    [ids, user, router],
  );

  return { ids, toggle };
}

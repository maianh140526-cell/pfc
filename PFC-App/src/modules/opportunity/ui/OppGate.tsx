"use client";

import type { ReactNode } from "react";
import { HubErrorState, ListSkeleton, PfcLoginPrompt } from "@/platform/hub-proxy/HubStates";
import { OPP_RUN_HINT, useOppSession } from "../session";
import type { OppUser } from "../types";

/** Renders children only for a signed-in Opportunity member; otherwise login / offline state. */
export function OppGate({ children }: { children: (user: OppUser) => ReactNode }) {
  const { user, loading, error, refresh } = useOppSession();
  if (loading) return <ListSkeleton rows={3} />;
  if (error) return <HubErrorState error={error} onRetry={refresh} hubName="Cơ hội" runHint={OPP_RUN_HINT} />;
  if (!user) {
    return <PfcLoginPrompt hubName="Cơ hội" />;
  }
  return <>{children(user)}</>;
}

"use client";

import { createContext, useCallback, useContext, type ReactNode } from "react";
import { hubFetch, useHub, type HubError } from "@/platform/hub-proxy/client";
import { HubErrorState, ListSkeleton, PfcLoginPrompt } from "@/platform/hub-proxy/HubStates";
import type { ClubHome } from "./types";

type ClubCtx = {
  home: ClubHome;
  can: (permission: string) => boolean;
  reload: () => Promise<void>;
  /** POST an action; reloads the club snapshot afterwards. */
  act: <T = Record<string, unknown>>(action: string, body?: Record<string, unknown>) => Promise<T>;
};

const Ctx = createContext<ClubCtx | null>(null);

export const CLUB_RUN_HINT = "Máy chủ Câu lạc bộ (cổng 3000) chưa chạy hoặc đang khởi động. Trong thư mục PFC-App chạy: npm run start:all — rồi bấm Thử lại.";

export async function clubPost<T = Record<string, unknown>>(action: string, body: Record<string, unknown> = {}): Promise<T> {
  return hubFetch<T>("club", "", {
    method: "POST",
    headers: { "idempotency-key": `pfc-${crypto.randomUUID()}` },
    json: { action, ...body },
  });
}

/**
 * Loads the Club snapshot (action=home: club, my membership, permissions, members, kanban,
 * activities, approvals, notifications) once for the whole hub. Handles sign-in and
 * not-a-member (private club → 403) states before rendering any Club screen.
 */
export function ClubProvider({ children, joinScreen, header }: { children: ReactNode; joinScreen: ReactNode; header: ReactNode }) {
  const { data, error, loading, reload } = useHub<ClubHome>("club", "?action=home");

  const act = useCallback(async <T,>(action: string, body: Record<string, unknown> = {}) => {
    const r = await clubPost<T>(action, body);
    await reload();
    return r;
  }, [reload]);

  if (loading && !data) return <>{header}<ListSkeleton /></>;
  if (error?.unauthorized) {
    return (
      <>
      {header}
      <PfcLoginPrompt hubName="Câu lạc bộ" />
      </>
    );
  }
  if (error?.status === 403) return <>{joinScreen}</>;
  if (error || !data) {
    return (
      <>
        {header}
        <HubErrorState error={error as HubError} onRetry={reload} hubName="Câu lạc bộ" runHint={CLUB_RUN_HINT} />
      </>
    );
  }

  const perms = new Set(data.permissions ?? []);
  return (
    <Ctx.Provider value={{ home: data, can: (p) => perms.has(p) || !!data.user?.isSuperAdmin , reload, act }}>{children}</Ctx.Provider>
  );
}

export function useClub(): ClubCtx {
  const v = useContext(Ctx);
  if (!v) throw new Error("useClub outside ClubProvider");
  return v;
}

export function allTasks(home: ClubHome) {
  return Object.values(home.kanban ?? {}).flat();
}

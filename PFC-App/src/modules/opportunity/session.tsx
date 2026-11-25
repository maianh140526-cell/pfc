"use client";

import { createContext, useContext, type ReactNode } from "react";
import { useHub, type HubError } from "@/platform/hub-proxy/client";
import type { OppUser } from "./types";

type OppSession = {
  user: OppUser | null;
  loading: boolean;
  /** Set when the backend is unreachable (not when simply signed out). */
  error: HubError | null;
  refresh: () => Promise<void>;
};

const Ctx = createContext<OppSession | null>(null);

export function OppSessionProvider({ children }: { children: ReactNode }) {
  const me = useHub<OppUser>("opp", "/auth/me");
  const signedOut = me.error?.unauthorized ?? false;


  return (
    <Ctx.Provider
      value={{
        user: signedOut ? null : me.data,
        loading: me.loading && !me.data && !me.error,
        error: signedOut ? null : me.error,
        refresh: me.reload,
      }}
    >
      {children}
    </Ctx.Provider>
  );
}

export function useOppSession(): OppSession {
  const v = useContext(Ctx);
  if (!v) throw new Error("useOppSession outside OppSessionProvider");
  return v;
}

export const OPP_RUN_HINT = "Máy chủ Cơ hội (cổng 3001) chưa chạy hoặc đang khởi động. Trong thư mục PFC-App chạy: npm run start:all — rồi bấm Thử lại.";

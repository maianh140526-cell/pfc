"use client";

import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from "react";
import { isIosSafari, isIosUserAgent, resolveInstallMode, type InstallMode } from "./platform-detect";

type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
};

type PwaState = {
  installMode: InstallMode;
  iosSafari: boolean;
  online: boolean;
  updateReady: boolean;
  promptInstall: () => Promise<void>;
  applyUpdate: () => void;
};

const PwaContext = createContext<PwaState | null>(null);

export function usePwa(): PwaState {
  const ctx = useContext(PwaContext);
  if (!ctx) throw new Error("usePwa must be used inside <PwaProvider>");
  return ctx;
}

function isStandalone(): boolean {
  return (
    window.matchMedia("(display-mode: standalone)").matches ||
    (navigator as Navigator & { standalone?: boolean }).standalone === true
  );
}

/**
 * Registers the service worker (production only — it would fight dev hot reload),
 * captures Android's install prompt, tracks online state and pending SW updates.
 */
export function PwaProvider({ children }: { children: ReactNode }) {
  const [deferred, setDeferred] = useState<BeforeInstallPromptEvent | null>(null);
  const [standalone, setStandalone] = useState(false);
  const [ios, setIos] = useState(false);
  const [iosSafari, setIosSafari] = useState(false);
  const [online, setOnline] = useState(true);
  const [waiting, setWaiting] = useState<ServiceWorker | null>(null);

  useEffect(() => {
    setStandalone(isStandalone());
    setIos(isIosUserAgent(navigator.userAgent, navigator.maxTouchPoints));
    setIosSafari(isIosSafari(navigator.userAgent));
    setOnline(navigator.onLine);

    const onPrompt = (e: Event) => {
      e.preventDefault(); // show our own button instead of the mini-infobar
      setDeferred(e as BeforeInstallPromptEvent);
    };
    const onInstalled = () => {
      setDeferred(null);
      setStandalone(true);
    };
    const onOnline = () => setOnline(true);
    const onOffline = () => setOnline(false);
    window.addEventListener("beforeinstallprompt", onPrompt);
    window.addEventListener("appinstalled", onInstalled);
    window.addEventListener("online", onOnline);
    window.addEventListener("offline", onOffline);
    return () => {
      window.removeEventListener("beforeinstallprompt", onPrompt);
      window.removeEventListener("appinstalled", onInstalled);
      window.removeEventListener("online", onOnline);
      window.removeEventListener("offline", onOffline);
    };
  }, []);

  useEffect(() => {
    if (process.env.NODE_ENV !== "production" || !("serviceWorker" in navigator)) return;
    let reloading = false;
    const onControllerChange = () => {
      if (reloading) return;
      reloading = true;
      window.location.reload();
    };

    navigator.serviceWorker
      .register("/sw.js", { scope: "/", updateViaCache: "none" })
      .then((reg) => {
        if (reg.waiting && navigator.serviceWorker.controller) setWaiting(reg.waiting);
        reg.addEventListener("updatefound", () => {
          const next = reg.installing;
          next?.addEventListener("statechange", () => {
            // A new version installed while an old one controls the page → offer update.
            if (next.state === "installed" && navigator.serviceWorker.controller) setWaiting(next);
          });
        });
      })
      .catch(() => {
        /* SW is progressive enhancement; the site keeps working without it */
      });
    navigator.serviceWorker.addEventListener("controllerchange", onControllerChange);
    return () => navigator.serviceWorker.removeEventListener("controllerchange", onControllerChange);
  }, []);

  const promptInstall = useCallback(async () => {
    if (!deferred) return;
    await deferred.prompt();
    await deferred.userChoice;
    setDeferred(null); // the event can only be used once
  }, [deferred]);

  const applyUpdate = useCallback(() => {
    waiting?.postMessage({ type: "SKIP_WAITING" });
  }, [waiting]);

  const value: PwaState = {
    installMode: resolveInstallMode({ standalone, hasDeferredPrompt: deferred !== null, ios }),
    iosSafari,
    online,
    updateReady: waiting !== null,
    promptInstall,
    applyUpdate,
  };

  return <PwaContext.Provider value={value}>{children}</PwaContext.Provider>;
}

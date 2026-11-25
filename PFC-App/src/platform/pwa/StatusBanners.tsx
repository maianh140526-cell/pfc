"use client";

import { RefreshCw, WifiOff } from "lucide-react";
import { usePwa } from "./PwaProvider";

/** Offline notice (Screen Inventory §5 "Offline / network error") and new-version prompt. */
export function StatusBanners() {
  const { online, updateReady, applyUpdate } = usePwa();
  if (online && !updateReady) return null;

  return (
    <div className="fixed-in-canvas top-[calc(var(--safe-top)+8px)] z-50 px-3" role="status" aria-live="polite">
      {!online ? (
        <div className="flex items-center gap-2 rounded-2xl bg-ink px-4 py-3 text-[14px] font-medium text-bg shadow-sheet">
          <WifiOff size={18} /> Mất kết nối mạng. Một số tính năng tạm thời không dùng được.
        </div>
      ) : (
        <button
          type="button"
          onClick={applyUpdate}
          className="pressable flex w-full items-center gap-2 rounded-2xl bg-primary px-4 py-3 text-left text-[14px] font-semibold text-on-primary shadow-sheet"
        >
          <RefreshCw size={18} /> Đã có phiên bản mới — chạm để cập nhật
        </button>
      )}
    </div>
  );
}

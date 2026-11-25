"use client";

import { X } from "lucide-react";
import { useEffect, useId, useRef, type ReactNode } from "react";
import { createPortal } from "react-dom";

/**
 * Mobile replacement for modals: slides up from the bottom, closes on backdrop tap,
 * Escape, or the close button. Locks page scroll while open and restores focus on close.
 */
export function BottomSheet({
  open,
  onClose,
  title,
  children,
  footer,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  children: ReactNode;
  footer?: ReactNode;
}) {
  const titleId = useId();
  const panelRef = useRef<HTMLDivElement>(null);
  // Ref so a new onClose identity on each parent render doesn't re-run the effect
  // (which would re-focus the panel and steal focus from inputs inside the sheet).
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;

  useEffect(() => {
    if (!open) return;
    const previous = document.activeElement as HTMLElement | null;
    const { overflow } = document.body.style;
    document.body.style.overflow = "hidden";
    panelRef.current?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onCloseRef.current();
    };
    window.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = overflow;
      window.removeEventListener("keydown", onKey);
      previous?.focus?.();
    };
  }, [open]);

  if (!open || typeof document === "undefined") return null;

  return createPortal(
    <div className="fixed inset-0 z-50">
      <div className="backdrop-enter absolute inset-0 bg-black/45" onClick={onClose} aria-hidden="true" />
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        tabIndex={-1}
        className="fixed-in-canvas sheet-enter bottom-0 flex max-h-[88dvh] flex-col rounded-t-[28px] bg-surface pb-[var(--safe-bottom)] shadow-sheet outline-none"
      >
        <div className="mx-auto mt-2 h-1.5 w-10 rounded-full bg-line" aria-hidden="true" />
        <div className="flex items-center gap-2 px-4 pt-2 pb-1">
          <h2 id={titleId} className="flex-1 text-[18px] font-bold text-ink">
            {title}
          </h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Đóng"
            className="pressable grid size-10 place-items-center rounded-full bg-surface-2 text-ink-2"
          >
            <X size={20} />
          </button>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-4 pt-2 pb-4">{children}</div>
        {footer && <div className="border-t border-line px-4 pt-3 pb-4">{footer}</div>}
      </div>
    </div>,
    document.body,
  );
}

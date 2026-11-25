"use client";

import { Plus } from "lucide-react";

/** Floating "+" action (mockup 19/24/48); sits above the tab bar. */
export function Fab({ label, onClick }: { label: string; onClick: () => void }) {
  return (
    <div className="fixed-in-canvas pointer-events-none bottom-[calc(var(--tabbar-h)+var(--safe-bottom)+16px)] z-30 flex justify-end px-4">
      <button
        type="button"
        onClick={onClick}
        aria-label={label}
        className="pressable pointer-events-auto grid size-14 place-items-center rounded-full bg-primary text-on-primary shadow-sheet"
      >
        <Plus size={28} strokeWidth={2.4} />
      </button>
    </div>
  );
}

/** Same floating "+" as a link (server pages: "Viết bài", "Tạo sự kiện"…). */
export function FabLink({ label, href }: { label: string; href: string }) {
  return (
    <div className="fixed-in-canvas pointer-events-none bottom-[calc(var(--tabbar-h)+var(--safe-bottom)+16px)] z-30 flex justify-end px-4">
      <a href={href} aria-label={label} className="pressable pointer-events-auto grid size-14 place-items-center rounded-full bg-primary text-on-primary shadow-sheet">
        <Plus size={28} strokeWidth={2.4} />
      </a>
    </div>
  );
}

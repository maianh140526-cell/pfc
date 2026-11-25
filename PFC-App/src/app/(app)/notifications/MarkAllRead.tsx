"use client";

import { CheckCheck } from "lucide-react";
import { markAllReadAction } from "@/platform/notifications/actions";
import { useAction } from "@/ui/use-action";

export function MarkAllRead() {
  const a = useAction();
  return (
    <button type="button" disabled={a.pending} onClick={() => a.run(() => markAllReadAction())} className="flex min-h-11 items-center gap-1.5 text-[14px] font-semibold text-primary">
      <CheckCheck size={18} /> Đánh dấu đã đọc tất cả
    </button>
  );
}

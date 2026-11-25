"use client";

import { Copy } from "lucide-react";
import { copyPreviousBudgetsAction } from "@/modules/finance/server/actions";
import { Button } from "@/ui";
import { useAction } from "@/ui/use-action";

export function CopyBudgetsButton({ month }: { month: string }) {
  const { run, pending, error } = useAction();
  return (
    <div className="text-center">
      <Button variant="ghost" block disabled={pending} onClick={() => run(() => copyPreviousBudgetsAction(month))}>
        <Copy size={18} /> {pending ? "Đang sao chép…" : "Sao chép ngân sách tháng trước"}
      </Button>
      {error && <p className="mt-1 text-[13px] text-muted">{error}</p>}
    </div>
  );
}

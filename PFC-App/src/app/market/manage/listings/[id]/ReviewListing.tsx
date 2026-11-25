"use client";

import { useRouter } from "next/navigation";
import { listingTransitionAction } from "@/modules/market/server/actions";
import type { ContentStatus } from "@/platform/workflow";
import { WorkflowBar } from "@/ui/WorkflowBar";

export function ReviewListing({ id, status }: { id: string; status: ContentStatus }) {
  const router = useRouter();
  return (
    <WorkflowBar
      status={status}
      isAuthor={false}
      canApprove
      onAction={async (a, r) => {
        const res = await listingTransitionAction(id, a, r);
        if (res.ok) router.replace("/market/manage");
        return res.ok ? { ok: true } : res;
      }}
    />
  );
}

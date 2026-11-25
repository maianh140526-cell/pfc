"use client";

import Link from "next/link";
import { Building2, Plus, Users } from "lucide-react";
import { useState } from "react";
import { hubFetch, useHub } from "@/platform/hub-proxy/client";
import { HubErrorState, ListSkeleton } from "@/platform/hub-proxy/HubStates";
import { OPP_RUN_HINT } from "@/modules/opportunity/session";
import { OPP_STATUS, TYPE_LABEL, formatDate, type Opportunity } from "@/modules/opportunity/types";
import { OppGate } from "@/modules/opportunity/ui/OppGate";
import { AppHeader, Badge, Button, ButtonLink, Card, EmptyState, HeaderIconButton } from "@/ui";

/** OPP-A01 Opportunity Management (provider). Draft → submit for verification (FR-OPP-006). */
export default function ProviderPage() {
  return (
    <>
      <AppHeader
        back
        backFallback="/opportunities/account"
        title="Tin đăng của tôi"
        actions={
          <HeaderIconButton label="Tạo tin" href="/opportunities/provider/new">
            <Plus size={24} />
          </HeaderIconButton>
        }
      />
      <OppGate>{() => <ProviderList />}</OppGate>
    </>
  );
}

function ProviderList() {
  const { data, error, loading, reload } = useHub<{ items: Opportunity[] }>("opp", "/provider/opportunities");
  const [busy, setBusy] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);
  if (loading && !data) return <ListSkeleton />;
  if (error) return <HubErrorState error={error} onRetry={reload} hubName="Cơ hội" runHint={OPP_RUN_HINT} />;
  const items = data?.items ?? [];

  async function submit(id: string) {
    setBusy(id);
    setErr(null);
    try {
      await hubFetch("opp", `/provider/opportunities/${id}/submit`, { method: "POST" });
      await reload();
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Gửi xác minh thất bại.");
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="space-y-3 px-4 pt-2">
      <ButtonLink href="/opportunities/provider/applicants" variant="secondary" block>
        <Users size={18} /> Xem ứng viên
      </ButtonLink>
      {err && <p className="text-[14px] text-expense">{err}</p>}
      {items.length === 0 ? (
        <EmptyState
          icon={Building2}
          title="Chưa có tin đăng"
          description="Tạo tin, rồi gửi để PFC xác minh trước khi hiển thị công khai."
          action={
            <ButtonLink href="/opportunities/provider/new" block>
              Tạo tin đăng
            </ButtonLink>
          }
        />
      ) : (
        items.map((o) => {
          const s = OPP_STATUS[o.status];
          return (
            <Card key={o.id}>
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="text-[15px] font-bold text-ink">{o.title}</p>
                  <p className="text-[12px] text-muted">
                    {TYPE_LABEL[o.type]} · cập nhật {formatDate(o.updatedAt)}
                  </p>
                </div>
                <Badge tone={s.tone}>{s.label}</Badge>
              </div>
              <div className="mt-3 flex gap-2">
                {o.status === "DRAFT" && (
                  <Button className="min-h-10 flex-1 text-[14px]" disabled={busy === o.id} onClick={() => submit(o.id)}>
                    {busy === o.id ? "Đang gửi…" : "Gửi xác minh"}
                  </Button>
                )}
                {o.status === "VERIFIED" && (
                  <Link href={`/opportunities/${o.id}`} className="text-[14px] font-semibold text-primary">
                    Xem tin công khai
                  </Link>
                )}
              </div>
            </Card>
          );
        })
      )}
    </div>
  );
}

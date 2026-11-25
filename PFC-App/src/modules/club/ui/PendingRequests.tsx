"use client";

import { useState } from "react";
import { Button, Card } from "@/ui";
import { FormError, TextArea } from "@/ui/Form";
import { useClub } from "../session";
import { fmtDate } from "../types";
import { Avatar } from "./Avatar";

/** Join requests waiting for approval (Pending → Active / Rejected). Shown only to people who may approve. */
export function PendingRequests() {
  const { home, can, act } = useClub();
  const [busy, setBusy] = useState<string | null>(null);
  const [rejecting, setRejecting] = useState<string | null>(null);
  const [reason, setReason] = useState("");
  const [err, setErr] = useState<string | null>(null);
  if (!can("approve_memberships")) return null;
  const pending = home.members.filter((m) => m.status === "pending");
  if (!pending.length) return null;

  async function decide(id: string, to: "active" | "rejected") {
    if (to === "rejected" && reason.trim().length < 3) return setErr("Ghi lý do từ chối để người xin vào biết cần bổ sung gì.");
    setBusy(id);
    setErr(null);
    try {
      await act("membership_transition", { membershipId: id, to, note: to === "rejected" ? reason.trim() : undefined });
      setRejecting(null);
      setReason("");
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Thao tác thất bại.");
    } finally {
      setBusy(null);
    }
  }

  return (
    <section className="px-4 pt-3" aria-label="Yêu cầu tham gia">
      <p className="mb-2 text-[13px] font-semibold text-muted uppercase">Yêu cầu tham gia ({pending.length})</p>
      <div className="space-y-2">
        {pending.map((m) => (
          <Card key={m.id} className="p-3">
            <div className="flex items-center gap-3">
              <Avatar name={m.fullName} />
              <div className="min-w-0 flex-1">
                <p className="truncate text-[15px] font-bold text-ink">{m.fullName}</p>
                <p className="truncate text-[12px] text-muted">
                  {m.email}
                  {m.createdAt ? ` · ${fmtDate(m.createdAt)}` : ""}
                </p>
              </div>
            </div>
            {m.joinReason && <p className="mt-2 text-[14px] text-ink-2">“{m.joinReason}”</p>}
            {rejecting === m.id ? (
              <div className="mt-2 space-y-2">
                <TextArea label="Lý do từ chối (người xin vào sẽ thấy)" value={reason} onChange={(e) => setReason(e.target.value)} maxLength={300} />
                <div className="grid grid-cols-2 gap-2">
                  <Button variant="secondary" className="min-h-10 text-[14px]" onClick={() => (setRejecting(null), setReason(""))}>
                    Thôi
                  </Button>
                  <Button variant="danger" className="min-h-10 text-[14px]" disabled={busy === m.id} onClick={() => decide(m.id, "rejected")}>
                    Từ chối
                  </Button>
                </div>
              </div>
            ) : (
              <div className="mt-2 grid grid-cols-2 gap-2">
                <Button variant="secondary" className="min-h-10 text-[14px]" disabled={busy === m.id} onClick={() => (setRejecting(m.id), setReason(""))}>
                  Từ chối
                </Button>
                <Button className="min-h-10 text-[14px]" disabled={busy === m.id} onClick={() => decide(m.id, "active")}>
                  Duyệt
                </Button>
              </div>
            )}
          </Card>
        ))}
      </div>
      <FormError message={err} />
    </section>
  );
}

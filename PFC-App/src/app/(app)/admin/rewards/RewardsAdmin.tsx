"use client";

import { useState } from "react";
import type { Reward } from "@/modules/rewards/server/service";
import { decideRedemptionAction, saveRewardAction } from "@/modules/rewards/server/actions";
import { BottomSheet, Button } from "@/ui";
import { FormError, SelectInput, TextArea, TextInput, Toggle } from "@/ui/Form";
import { useAction } from "@/ui/use-action";

type Draft = { id: string | null; title: string; description: string; partner: string; cost: string; stock: string; minTier: string; active: boolean };
const empty: Draft = { id: null, title: "", description: "", partner: "", cost: "", stock: "", minTier: "", active: true };

export function RewardCatalog({ rewards, tiers }: { rewards: Reward[]; tiers: [string, string][] }) {
  const a = useAction();
  const [d, setD] = useState<Draft | null>(null);
  return (
    <>
      <ul className="space-y-2">
        {rewards.map((r) => (
          <li key={r.id}>
            <button
              type="button"
              onClick={() => setD({ id: r.id, title: r.title, description: r.description, partner: r.partner, cost: String(r.cost), stock: r.stock === null ? "" : String(r.stock), minTier: r.minTier ?? "", active: r.active })}
              className="flex w-full items-center justify-between gap-3 rounded-xl border border-line bg-surface px-4 py-3 text-left"
            >
              <span className="min-w-0">
                <span className={`block truncate text-[14px] font-semibold ${r.active ? "text-ink" : "text-muted line-through"}`}>{r.title}</span>
                <span className="block text-[12px] text-muted">
                  {r.partner || "PFC"} · {r.stock === null ? "không giới hạn" : `còn ${r.stock}`}
                </span>
              </span>
              <b className="shrink-0 text-primary">{r.cost.toLocaleString("vi-VN")} đ</b>
            </button>
          </li>
        ))}
      </ul>
      <Button className="mt-2" variant="secondary" block onClick={() => setD(empty)}>
        Thêm quà
      </Button>
      <BottomSheet open={d !== null} onClose={() => setD(null)} title={d?.id ? "Sửa quà" : "Thêm quà"}>
        {d && (
          <form
            className="space-y-3"
            onSubmit={(e) => {
              e.preventDefault();
              a.run(() => saveRewardAction(d.id, { ...d, cost: Number(d.cost || 0), stock: d.stock === "" ? null : Number(d.stock), minTier: d.minTier || null }), () => setD(null));
            }}
          >
            <TextInput label="Tên quà" value={d.title} onChange={(e) => setD({ ...d, title: e.target.value })} maxLength={80} />
            <TextInput label="Đối tác" hint="Bỏ trống nếu quà của PFC" value={d.partner} onChange={(e) => setD({ ...d, partner: e.target.value })} maxLength={80} />
            <TextArea label="Mô tả, điều kiện" value={d.description} onChange={(e) => setD({ ...d, description: e.target.value })} maxLength={500} />
            <div className="grid grid-cols-2 gap-2">
              <TextInput label="Điểm cần" inputMode="numeric" value={d.cost} onChange={(e) => setD({ ...d, cost: e.target.value.replace(/\D/g, "") })} />
              <TextInput label="Số lượng" hint="Trống = không giới hạn" inputMode="numeric" value={d.stock} onChange={(e) => setD({ ...d, stock: e.target.value.replace(/\D/g, "") })} />
            </div>
            <SelectInput label="Hạng tối thiểu" value={d.minTier} onChange={(e) => setD({ ...d, minTier: e.target.value })}>
              <option value="">Mọi hạng</option>
              {tiers.map(([k, l]) => (
                <option key={k} value={k}>
                  {l}
                </option>
              ))}
            </SelectInput>
            <Toggle checked={d.active} onChange={(active) => setD({ ...d, active })} label="Đang cho đổi" />
            <FormError message={a.error} />
            <Button type="submit" block disabled={a.pending}>
              Lưu
            </Button>
          </form>
        )}
      </BottomSheet>
    </>
  );
}

export function RedemptionDecision({ id }: { id: string }) {
  const a = useAction();
  const [note, setNote] = useState("");
  return (
    <div className="mt-2 space-y-2">
      <TextInput label="Ghi chú (mã voucher, nơi nhận / lý do hủy)" value={note} onChange={(e) => setNote(e.target.value)} maxLength={300} />
      <div className="grid grid-cols-2 gap-2">
        <Button variant="secondary" disabled={a.pending || note.trim().length < 3} onClick={() => a.run(() => decideRedemptionAction(id, false, note))}>
          Hủy, hoàn điểm
        </Button>
        <Button disabled={a.pending} onClick={() => a.run(() => decideRedemptionAction(id, true, note))}>
          Đã trao quà
        </Button>
      </div>
      <FormError message={a.error} />
    </div>
  );
}

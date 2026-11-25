"use client";

import { Plus, Trash2 } from "lucide-react";
import { useState } from "react";
import { saveMarketAction, saveRulesAction, saveTiersAction, setFlagAction } from "@/platform/admin/console-actions";
import type { RuleConfig, Tier } from "@/platform/settings/defaults";
import { Button } from "@/ui";
import { FormError, TextInput, Toggle } from "@/ui/Form";
import { useAction } from "@/ui/use-action";

export function FlagToggles({ flags }: { flags: { key: string; label: string; description: string; on: boolean }[] }) {
  const a = useAction();
  const [state, setState] = useState(Object.fromEntries(flags.map((f) => [f.key, f.on])));
  return (
    <div className="divide-y divide-line rounded-[var(--radius-card)] border border-line bg-surface px-4">
      {flags.map((f) => (
        <Toggle
          key={f.key}
          checked={state[f.key]}
          label={f.label}
          description={f.description}
          onChange={(on) => {
            setState({ ...state, [f.key]: on });
            a.run(() => setFlagAction(f.key, on));
          }}
        />
      ))}
      <FormError message={a.error} />
    </div>
  );
}

export function RulesEditor({ rules }: { rules: { key: string; label: string; cfg: RuleConfig }[] }) {
  const a = useAction();
  const [v, setV] = useState(Object.fromEntries(rules.map((r) => [r.key, { points: String(r.cfg.points), cap: r.cfg.cap === null ? "" : String(r.cfg.cap), enabled: r.cfg.enabled }])));
  return (
    <div className="space-y-3">
      {rules.map((r) => (
        <div key={r.key} className="rounded-xl border border-line bg-surface p-3">
          <Toggle checked={v[r.key].enabled} label={r.label} onChange={(enabled) => setV({ ...v, [r.key]: { ...v[r.key], enabled } })} />
          <div className="grid grid-cols-2 gap-2">
            <TextInput label="Điểm" inputMode="numeric" value={v[r.key].points} onChange={(e) => setV({ ...v, [r.key]: { ...v[r.key], points: e.target.value.replace(/\D/g, "") } })} />
            <TextInput label="Tối đa / ngày" hint="Trống = không giới hạn" inputMode="numeric" value={v[r.key].cap} onChange={(e) => setV({ ...v, [r.key]: { ...v[r.key], cap: e.target.value.replace(/\D/g, "") } })} />
          </div>
        </div>
      ))}
      <FormError message={a.error} />
      <Button
        block
        disabled={a.pending}
        onClick={() => a.run(() => saveRulesAction(Object.fromEntries(Object.entries(v).map(([k, x]) => [k, { points: Number(x.points || 0), cap: x.cap ? Number(x.cap) : null, enabled: x.enabled }]))))}
      >
        {a.pending ? "Đang lưu…" : "Lưu quy tắc điểm"}
      </Button>
    </div>
  );
}

export function TiersEditor({ tiers }: { tiers: Tier[] }) {
  const a = useAction();
  const [v, setV] = useState(tiers.map((t) => ({ ...t, min: String(t.min) })));
  const upd = (i: number, patch: Partial<(typeof v)[number]>) => setV(v.map((x, j) => (j === i ? { ...x, ...patch } : x)));
  return (
    <div className="space-y-3">
      {v.map((t, i) => (
        <div key={i} className="space-y-2 rounded-xl border border-line bg-surface p-3">
          <div className="grid grid-cols-[1fr_1fr_44px] items-end gap-2">
            <TextInput label="Tên hạng" value={t.label} onChange={(e) => upd(i, { label: e.target.value })} maxLength={30} />
            <TextInput label="Từ (điểm)" inputMode="numeric" value={t.min} onChange={(e) => upd(i, { min: e.target.value.replace(/\D/g, "") })} />
            {v.length > 1 && (
              <button type="button" aria-label="Xóa hạng" className="mb-1 grid size-11 place-items-center text-expense" onClick={() => setV(v.filter((_, j) => j !== i))}>
                <Trash2 size={18} />
              </button>
            )}
          </div>
          <TextInput label="Mã (chữ thường, không dấu)" value={t.key} onChange={(e) => upd(i, { key: e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, "") })} maxLength={20} />
          <TextInput label="Quyền lợi" value={t.benefits} onChange={(e) => upd(i, { benefits: e.target.value })} maxLength={300} />
        </div>
      ))}
      {v.length < 8 && (
        <Button variant="ghost" onClick={() => setV([...v, { key: `tier${v.length + 1}`, label: "", min: "", benefits: "" }])}>
          <Plus size={18} /> Thêm hạng
        </Button>
      )}
      <FormError message={a.error} />
      <Button block disabled={a.pending} onClick={() => a.run(() => saveTiersAction(v.map((t) => ({ ...t, min: Number(t.min || 0) }))))}>
        {a.pending ? "Đang lưu…" : "Lưu hạng thành viên"}
      </Button>
    </div>
  );
}

export function MarketEditor({ market }: { market: { basicMaxPrice: number; basicMaxListings: number } }) {
  const a = useAction();
  const [price, setPrice] = useState(String(market.basicMaxPrice));
  const [count, setCount] = useState(String(market.basicMaxListings));
  return (
    <div className="space-y-3">
      <TextInput label="Giá tối đa / món (₫) cho cửa hàng chưa xác minh" inputMode="numeric" value={price} onChange={(e) => setPrice(e.target.value.replace(/\D/g, ""))} />
      <TextInput label="Số tin đang hoạt động tối đa" inputMode="numeric" value={count} onChange={(e) => setCount(e.target.value.replace(/\D/g, ""))} />
      <FormError message={a.error} />
      <Button block disabled={a.pending} onClick={() => a.run(() => saveMarketAction({ basicMaxPrice: Number(price || 0), basicMaxListings: Number(count || 0) }))}>
        {a.pending ? "Đang lưu…" : "Lưu giới hạn Marketplace"}
      </Button>
    </div>
  );
}

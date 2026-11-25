"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { formatVnd } from "@/lib/money";
import { AmountInput, Button } from "@/ui";
import { FormError, SelectInput, TextInput } from "@/ui/Form";
import { useAction } from "@/ui/use-action";
import { HOLDING_KINDS, holdingValue, type HoldingKind } from "../domain/invest";
import { deleteHoldingAction, saveHoldingAction } from "../server/g6-actions";

type V = { name: string; symbol: string; kind: HoldingKind; quantity: string; avgCost: string; currentPrice: string; note: string };

/** Add / edit a holding. Prices are per unit (cổ phiếu, chỉ vàng, chứng chỉ quỹ…); for deposits use quantity 1. */
export function HoldingForm({ id, initial }: { id?: string; initial?: V }) {
  const router = useRouter();
  const a = useAction();
  const del = useAction();
  const [v, setV] = useState<V>(initial ?? { name: "", symbol: "", kind: "stock", quantity: "", avgCost: "", currentPrice: "", note: "" });
  const q = Number(v.quantity.replace(",", "."));
  const preview = q > 0 && v.avgCost && v.currentPrice ? holdingValue({ kind: v.kind, quantity: q, avgCost: Number(v.avgCost), currentPrice: Number(v.currentPrice) }) : null;
  return (
    <form
      className="space-y-4 px-4 pt-2 pb-6"
      noValidate
      onSubmit={(e) => {
        e.preventDefault();
        a.run(() => saveHoldingAction(id ?? null, { ...v, quantity: q, avgCost: Number(v.avgCost || 0), currentPrice: Number(v.currentPrice || 0) }), () => router.replace("/finance/invest"));
      }}
    >
      <SelectInput label="Loại tài sản" value={v.kind} onChange={(e) => setV({ ...v, kind: e.target.value as HoldingKind })}>
        {Object.entries(HOLDING_KINDS).map(([k, l]) => (
          <option key={k} value={k}>
            {l}
          </option>
        ))}
      </SelectInput>
      <div className="grid grid-cols-[1fr_110px] gap-3">
        <TextInput label="Tên" value={v.name} onChange={(e) => setV({ ...v, name: e.target.value })} maxLength={80} placeholder="VD: Vinamilk, Vàng SJC" />
        <TextInput label="Mã" hint="Không bắt buộc" value={v.symbol} onChange={(e) => setV({ ...v, symbol: e.target.value.toUpperCase() })} maxLength={20} />
      </div>
      <TextInput label="Số lượng" inputMode="decimal" value={v.quantity} onChange={(e) => setV({ ...v, quantity: e.target.value.replace(/[^\d.,]/g, "") })} hint="Số cổ phiếu, chỉ vàng, đơn vị quỹ… Tiền gửi: nhập 1" />
      <AmountInput label="Giá vốn trung bình / đơn vị" value={v.avgCost} onChange={(d) => setV({ ...v, avgCost: d })} />
      <AmountInput label="Giá hiện tại / đơn vị" value={v.currentPrice} onChange={(d) => setV({ ...v, currentPrice: d })} />
      <TextInput label="Ghi chú" value={v.note} onChange={(e) => setV({ ...v, note: e.target.value })} maxLength={200} />
      {preview && (
        <p className="rounded-xl bg-surface-2 px-4 py-3 text-[14px] text-ink-2">
          Giá trị {formatVnd(preview.value)} · vốn {formatVnd(preview.cost)} ·{" "}
          <b className={preview.gain >= 0 ? "text-income" : "text-expense"}>
            {preview.gain >= 0 ? "+" : ""}
            {formatVnd(preview.gain)}
          </b>
        </p>
      )}
      <FormError message={a.error ?? del.error} />
      <Button type="submit" block disabled={a.pending}>
        {a.pending ? "Đang lưu…" : id ? "Lưu thay đổi" : "Thêm tài sản"}
      </Button>
      {id && (
        <Button variant="ghost" block disabled={del.pending} onClick={() => del.run(() => deleteHoldingAction(id), () => router.replace("/finance/invest"))}>
          Xóa tài sản này
        </Button>
      )}
      <p className="text-[12px] text-muted">PFC không có dữ liệu giá thị trường: lãi/lỗ tính theo giá bạn tự cập nhật. Đây không phải tư vấn đầu tư.</p>
    </form>
  );
}

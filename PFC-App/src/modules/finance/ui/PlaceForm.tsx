"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button } from "@/ui";
import { FormError, SelectInput, TextArea, TextInput } from "@/ui/Form";
import { ImageUploader } from "@/ui/ImageUploader";
import { useAction } from "@/ui/use-action";
import { savePlaceAction } from "../server/g6-actions";

type V = { name: string; category: string; address: string; area: string; priceLevel: string; description: string; cover: string[] };

export function PlaceForm({ id, initial, categories, prices }: { id?: string; initial?: V; categories: [string, string][]; prices: [string, string][] }) {
  const router = useRouter();
  const a = useAction();
  const [v, setV] = useState<V>(initial ?? { name: "", category: "food", address: "", area: "", priceLevel: "1", description: "", cover: [] });
  return (
    <form
      className="space-y-4 px-4 pt-2 pb-6"
      noValidate
      onSubmit={(e) => {
        e.preventDefault();
        a.run(() => savePlaceAction(id ?? null, { ...v, priceLevel: Number(v.priceLevel), coverUrl: v.cover[0] ?? null }), (pid) => router.replace(`/finance/places/${pid}`));
      }}
    >
      <TextInput label="Tên địa điểm" value={v.name} onChange={(e) => setV({ ...v, name: e.target.value })} maxLength={80} />
      <div className="grid grid-cols-2 gap-3">
        <SelectInput label="Loại" value={v.category} onChange={(e) => setV({ ...v, category: e.target.value })}>
          {categories.map(([k, l]) => (
            <option key={k} value={k}>
              {l}
            </option>
          ))}
        </SelectInput>
        <SelectInput label="Mức giá / người" value={v.priceLevel} onChange={(e) => setV({ ...v, priceLevel: e.target.value })}>
          {prices.map(([k, l]) => (
            <option key={k} value={k}>
              {l}
            </option>
          ))}
        </SelectInput>
      </div>
      <TextInput label="Địa chỉ" value={v.address} onChange={(e) => setV({ ...v, address: e.target.value })} maxLength={200} autoComplete="street-address" />
      <TextInput label="Khu vực" hint="VD: Cầu Giấy, Đống Đa" value={v.area} onChange={(e) => setV({ ...v, area: e.target.value })} maxLength={60} />
      <TextArea label="Vì sao đáng đến?" value={v.description} onChange={(e) => setV({ ...v, description: e.target.value })} maxLength={1000} />
      <ImageUploader purpose="place" max={1} label="Ảnh" hint="Không bắt buộc. Ảnh bạn tự chụp." value={v.cover} onChange={(cover) => setV({ ...v, cover })} />
      <FormError message={a.error} />
      <Button type="submit" block disabled={a.pending}>
        {a.pending ? "Đang lưu…" : id ? "Lưu thay đổi" : "Chia sẻ địa điểm"}
      </Button>
    </form>
  );
}

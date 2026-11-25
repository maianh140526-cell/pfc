"use client";

import { X } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button } from "@/ui";
import { FormError, SelectInput, TextArea, TextInput, Toggle } from "@/ui/Form";
import { useAction } from "@/ui/use-action";
import { saveCollabProfileAction } from "../server/actions";

type V = { headline: string; skills: string[]; lookingFor: string; availability: string; open: boolean };

export function CollabForm({ initial, availability }: { initial: V | null; availability: [string, string][] }) {
  const router = useRouter();
  const a = useAction();
  const [v, setV] = useState<V>(initial ?? { headline: "", skills: [], lookingFor: "", availability: "part_time", open: true });
  const [skill, setSkill] = useState("");
  const addSkill = () => {
    const s = skill.trim().toLowerCase().replace(/,/g, " ");
    if (s && !v.skills.includes(s) && v.skills.length < 12) setV({ ...v, skills: [...v.skills, s] });
    setSkill("");
  };
  return (
    <form
      className="space-y-4 px-4 pt-2 pb-6"
      noValidate
      onSubmit={(e) => {
        e.preventDefault();
        a.run(() => saveCollabProfileAction(v), () => router.replace("/projects/collab"));
      }}
    >
      <TextInput label="Giới thiệu ngắn" placeholder="VD: SV năm 3 Tài chính, mạnh phân tích dữ liệu" value={v.headline} onChange={(e) => setV({ ...v, headline: e.target.value })} maxLength={120} />
      <div>
        <div className="flex items-end gap-2">
          <div className="flex-1">
            <TextInput
              label="Kỹ năng"
              hint="Nhấn Enter để thêm, tối đa 12"
              value={skill}
              onChange={(e) => setSkill(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  addSkill();
                }
              }}
              maxLength={30}
            />
          </div>
          <Button variant="secondary" onClick={addSkill} disabled={!skill.trim()} className="mb-6">
            Thêm
          </Button>
        </div>
        <ul className="flex flex-wrap gap-2">
          {v.skills.map((s) => (
            <li key={s}>
              <button type="button" onClick={() => setV({ ...v, skills: v.skills.filter((x) => x !== s) })} className="inline-flex min-h-9 items-center gap-1 rounded-full bg-primary-soft px-3 text-[13px] font-semibold text-primary" aria-label={`Bỏ kỹ năng ${s}`}>
                {s} <X size={14} />
              </button>
            </li>
          ))}
        </ul>
      </div>
      <TextArea label="Bạn muốn tham gia dự án như thế nào?" value={v.lookingFor} onChange={(e) => setV({ ...v, lookingFor: e.target.value })} maxLength={500} />
      <SelectInput label="Thời gian có thể dành" value={v.availability} onChange={(e) => setV({ ...v, availability: e.target.value })}>
        {availability.map(([k, l]) => (
          <option key={k} value={k}>
            {l}
          </option>
        ))}
      </SelectInput>
      <Toggle checked={v.open} onChange={(open) => setV({ ...v, open })} label="Đang tìm dự án" description="Tắt để ẩn hồ sơ khỏi danh sách cộng sự" />
      <FormError message={a.error} />
      <Button type="submit" block disabled={a.pending}>
        {a.pending ? "Đang lưu…" : "Lưu hồ sơ cộng sự"}
      </Button>
      <p className="text-[12px] text-muted">Người khác liên hệ bạn qua tin nhắn PFC, không thấy email. Nếu bạn đặt hồ sơ ở chế độ riêng tư, hồ sơ cộng sự cũng bị ẩn.</p>
    </form>
  );
}

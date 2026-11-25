"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button } from "@/ui";
import { FormError, SelectInput, TextArea, TextInput } from "@/ui/Form";
import { ImageUploader } from "@/ui/ImageUploader";
import { useAction } from "@/ui/use-action";
import { TOPICS, type GroupVisibility, type Topic } from "../domain/rules";
import { createGroupAction, updateGroupAction } from "../server/actions";

type V = { name: string; description: string; topic: Topic; visibility: GroupVisibility; cover: string[] };

export function GroupForm({ id, initial }: { id?: string; initial?: Omit<V, "cover"> & { coverUrl: string | null } }) {
  const router = useRouter();
  const a = useAction();
  const [v, setV] = useState<V>(initial ? { ...initial, cover: initial.coverUrl ? [initial.coverUrl] : [] } : { name: "", description: "", topic: "finance", visibility: "public", cover: [] });
  const payload = () => ({ name: v.name, description: v.description, topic: v.topic, visibility: v.visibility, coverUrl: v.cover[0] ?? null });
  return (
    <form
      className="space-y-4 px-4 pt-2"
      noValidate
      onSubmit={(e) => {
        e.preventDefault();
        if (id) a.run(() => updateGroupAction(id, payload()), () => router.replace(`/community/groups/${id}`));
        else a.run(() => createGroupAction(payload()), (gid) => router.replace(`/community/groups/${gid}`));
      }}
    >
      <TextInput label="Tên nhóm" value={v.name} onChange={(e) => setV({ ...v, name: e.target.value })} maxLength={60} />
      <TextArea label="Giới thiệu" value={v.description} onChange={(e) => setV({ ...v, description: e.target.value })} maxLength={1000} />
      <div className="grid grid-cols-2 gap-3">
        <SelectInput label="Chủ đề" value={v.topic} onChange={(e) => setV({ ...v, topic: e.target.value as Topic })}>
          {Object.entries(TOPICS).map(([k, l]) => (
            <option key={k} value={k}>
              {l}
            </option>
          ))}
        </SelectInput>
        <SelectInput label="Quyền riêng tư" value={v.visibility} onChange={(e) => setV({ ...v, visibility: e.target.value as GroupVisibility })}>
          <option value="public">Công khai</option>
          <option value="private">Riêng tư (duyệt thành viên)</option>
        </SelectInput>
      </div>
      <ImageUploader purpose="post" max={1} label="Ảnh bìa" hint="Không bắt buộc." value={v.cover} onChange={(cover) => setV({ ...v, cover })} />
      <FormError message={a.error} />
      <Button type="submit" block disabled={a.pending}>
        {a.pending ? "Đang lưu…" : id ? "Lưu thay đổi" : "Tạo nhóm"}
      </Button>
      <p className="text-[12px] text-muted">Bạn là chủ nhóm: duyệt thành viên (nhóm riêng tư), chỉ định điều hành viên, và là người duy nhất loại thành viên.</p>
    </form>
  );
}

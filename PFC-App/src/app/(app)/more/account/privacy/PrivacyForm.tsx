"use client";

import { useState } from "react";
import type { Privacy } from "@/platform/account/options";
import { setPrivacyAction } from "@/platform/account/actions";
import { Section } from "@/ui";
import { FormError, SelectInput, Toggle } from "@/ui/Form";
import { useAction } from "@/ui/use-action";

export function PrivacyForm({ initial }: { initial: Privacy }) {
  const [v, setV] = useState(initial);
  const a = useAction();
  const save = (next: Privacy) => {
    setV(next);
    a.run(() => setPrivacyAction(next));
  };
  return (
    <Section>
      <div className="space-y-4 rounded-[var(--radius-card)] border border-line bg-surface p-4">
        <SelectInput label="Ai có thể thấy hồ sơ của tôi trong tìm kiếm" value={v.profileVisibility} onChange={(e) => save({ ...v, profileVisibility: e.target.value as Privacy["profileVisibility"] })}>
          <option value="members">Thành viên PFC</option>
          <option value="private">Chỉ mình tôi</option>
        </SelectInput>
        <SelectInput label="Ai có thể gửi tin nhắn cho tôi" value={v.messages} onChange={(e) => save({ ...v, messages: e.target.value as Privacy["messages"] })}>
          <option value="members">Thành viên PFC</option>
          <option value="following">Chỉ người tôi theo dõi</option>
          <option value="none">Không ai</option>
        </SelectInput>
        <Toggle
          label="Cho phép tìm thấy qua email"
          description="Người khác nhập đúng email của bạn để mời vào dự án"
          checked={v.findByEmail}
          onChange={(b) => save({ ...v, findByEmail: b })}
        />
        <FormError message={a.error} />
        <p className="text-[12px] text-muted" role="status">
          {a.pending ? "Đang lưu…" : "Thay đổi được lưu ngay và ghi lại thời điểm bạn đồng ý."}
        </p>
      </div>
    </Section>
  );
}

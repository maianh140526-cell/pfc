"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { EXT_TYPE_LABEL, type ExtType } from "@/modules/oppfeed/domain/feed";
import { createPostAction, deletePostAction, setPostStateAction, updatePostAction } from "@/modules/oppfeed/server/actions";
import { Button, Section } from "@/ui";
import { FormError, SelectInput, TextArea, TextInput } from "@/ui/Form";
import { ImageUploader } from "@/ui/ImageUploader";
import { useAction } from "@/ui/use-action";

type V = { type: ExtType; title: string; organization: string; location: string; summary: string; url: string; deadlineAt: string; images: string[] };
type Existing = V & { id: string; closed: boolean };

/** Leaders (Ban điều hành, Trưởng ban) post a job, internship, scholarship or competition; it shows in "Từ các nguồn". */
export function PostForm({ existing }: { existing?: Existing }) {
  const router = useRouter();
  const [v, setV] = useState<V>(existing ?? { type: "job", title: "", organization: "", location: "", summary: "", url: "", deadlineAt: "", images: [] });
  const save = useAction();
  const state = useAction();
  const del = useAction();
  const set = (k: keyof V) => (e: { target: { value: string } }) => setV((x) => ({ ...x, [k]: e.target.value }));

  return (
    <>
      {existing && (
        <Section>
          <div className="flex gap-2">
            <Button variant="secondary" block disabled={state.pending} onClick={() => state.run(() => setPostStateAction(existing.id, existing.closed ? "open" : "closed"))}>
              {existing.closed ? "Mở lại tin" : "Đóng tin (đã đủ người / hết hạn)"}
            </Button>
          </div>
          <FormError message={state.error} />
        </Section>
      )}
      <form
        className="space-y-4 px-4 pt-3 pb-6"
        noValidate
        onSubmit={(e) => {
          e.preventDefault();
          const payload = { ...v, deadlineAt: v.deadlineAt || null };
          if (existing) save.run(() => updatePostAction(existing.id, payload), () => router.refresh());
          else save.run(() => createPostAction(payload), (id) => router.replace(`/opportunities/sources/${id}`));
        }}
      >
        <SelectInput label="Loại cơ hội" value={v.type} onChange={set("type")}>
          {Object.entries(EXT_TYPE_LABEL).map(([k, label]) => (
            <option key={k} value={k}>
              {label}
            </option>
          ))}
        </SelectInput>
        <TextInput label="Tiêu đề" value={v.title} onChange={set("title")} maxLength={160} placeholder="vd: Thực tập sinh Marketing — Công ty ABC" />
        <TextInput label="Đơn vị / tổ chức" value={v.organization} onChange={set("organization")} maxLength={120} />
        <TextInput label="Địa điểm" hint="Không bắt buộc" value={v.location} onChange={set("location")} maxLength={120} placeholder="vd: Hà Nội, hoặc Từ xa" />
        <ImageUploader purpose="opportunity" max={1} label="Ảnh bìa" hint="Poster, logo hoặc ảnh banner. Ảnh được nén và xóa thông tin vị trí." value={v.images} onChange={(images) => setV((x) => ({ ...x, images }))} />
        <TextArea label="Mô tả, yêu cầu, quyền lợi" value={v.summary} onChange={set("summary")} maxLength={2000} rows={7} placeholder="Nội dung công việc / học bổng / thể lệ, đối tượng, quyền lợi, cách nộp hồ sơ…" />
        <TextInput label="Link đăng ký / trang gốc (https)" hint="Không bắt buộc" type="url" inputMode="url" value={v.url} onChange={set("url")} placeholder="https://…" />
        <TextInput label="Hạn nộp hồ sơ" hint="Để trống nếu không giới hạn" type="date" value={v.deadlineAt} onChange={set("deadlineAt")} />
        <FormError message={save.error} />
        <Button type="submit" block disabled={save.pending}>
          {save.pending ? "Đang lưu…" : existing ? "Lưu thay đổi" : "Đăng cơ hội"}
        </Button>
        <p className="text-[12px] text-muted">Tin hiển thị ngay cho mọi thành viên. Chỉ đăng thông tin chính xác; nhờ người nhận hồ sơ xác nhận trước khi đăng.</p>
        {existing && (
          <>
            <FormError message={del.error} />
            <Button
              variant="danger"
              block
              disabled={del.pending}
              onClick={() => {
                if (window.confirm("Xóa hẳn tin này? Không hoàn tác được.")) del.run(() => deletePostAction(existing.id), () => router.replace("/opportunities/sources/manage"));
              }}
            >
              Xóa tin
            </Button>
          </>
        )}
      </form>
    </>
  );
}

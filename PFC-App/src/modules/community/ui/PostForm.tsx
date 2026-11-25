"use client";

import { useRouter } from "next/navigation";
import { Plus, Trash2 } from "lucide-react";
import { useState } from "react";
import { Button } from "@/ui";
import { FormError, SelectInput, TextArea, TextInput, Toggle } from "@/ui/Form";
import { ImageUploader } from "@/ui/ImageUploader";
import { cx } from "@/ui/cx";
import { useAction } from "@/ui/use-action";
import { TOPICS, type Topic } from "../domain/rules";
import { createPostAction, updatePostAction } from "../server/actions";

type Initial = { id: string; title: string; body: string; topic: Topic; images: string[]; allowComments: boolean };

/** COM-04 Create / COM-05 Edit Post (mockup 76). */
export function PostForm({ groups = [], defaultGroup, initial }: { groups?: { id: string; name: string }[]; defaultGroup?: string; initial?: Initial }) {
  const router = useRouter();
  const a = useAction();
  const [groupId, setGroupId] = useState(defaultGroup ?? "");
  const [title, setTitle] = useState(initial?.title ?? "");
  const [body, setBody] = useState(initial?.body ?? "");
  const [topic, setTopic] = useState<Topic>(initial?.topic ?? "finance");
  const [images, setImages] = useState<string[]>(initial?.images ?? []);
  const [allowComments, setAllowComments] = useState(initial?.allowComments ?? true);
  const [poll, setPoll] = useState<string[] | null>(null);

  const submit = (draft: boolean) => {
    const payload = { groupId: groupId || null, title, body, topic, images, allowComments, draft, poll: poll ?? undefined };
    if (initial) a.run(() => updatePostAction(initial.id, payload), () => router.replace(`/community/posts/${initial.id}`));
    else a.run(() => createPostAction(payload), (id) => router.replace(`/community/posts/${id}`));
  };

  return (
    <form className="space-y-4 px-4 pt-2" noValidate onSubmit={(e) => (e.preventDefault(), submit(false))}>
      {!initial && (
        <SelectInput label="Đăng trong" value={groupId} onChange={(e) => setGroupId(e.target.value)}>
          <option value="">Tất cả mọi người</option>
          {groups.map((g) => (
            <option key={g.id} value={g.id}>
              Nhóm: {g.name}
            </option>
          ))}
        </SelectInput>
      )}
      <TextInput label="Tiêu đề" value={title} onChange={(e) => setTitle(e.target.value)} maxLength={150} placeholder="Nhập tiêu đề bài viết…" />
      <TextArea label="Nội dung" value={body} onChange={(e) => setBody(e.target.value)} maxLength={10_000} rows={7} placeholder="Chia sẻ suy nghĩ, câu hỏi hoặc kinh nghiệm… Gắn #hashtag để mọi người dễ tìm." />
      <fieldset>
        <legend className="mb-1.5 text-[14px] font-semibold text-ink">Chủ đề</legend>
        <div className="flex flex-wrap gap-2">
          {(Object.keys(TOPICS) as Topic[]).map((t) => (
            <button
              key={t}
              type="button"
              aria-pressed={topic === t}
              onClick={() => setTopic(t)}
              className={cx("min-h-10 rounded-full px-3.5 text-[13px] font-semibold", topic === t ? "bg-primary text-on-primary" : "border border-line bg-surface text-ink-2")}
            >
              {TOPICS[t]}
            </button>
          ))}
        </div>
      </fieldset>
      <ImageUploader purpose="post" max={4} label="Ảnh" hint="Tối đa 4 ảnh, JPG/PNG/WebP. Thông tin vị trí trong ảnh được xóa." value={images} onChange={setImages} />
      {!initial &&
        (poll === null ? (
          <button type="button" onClick={() => setPoll(["", ""])} className="flex min-h-11 items-center gap-1.5 text-[14px] font-semibold text-primary">
            <Plus size={16} /> Thêm bình chọn
          </button>
        ) : (
          <fieldset className="space-y-2 rounded-[var(--radius-card)] border border-line bg-surface p-3">
            <legend className="px-1 text-[14px] font-semibold text-ink">Bình chọn</legend>
            {poll.map((o, i) => (
              <div key={i} className="flex gap-2">
                <TextInput label={`Lựa chọn ${i + 1}`} value={o} maxLength={80} onChange={(e) => setPoll(poll.map((x, j) => (j === i ? e.target.value : x)))} />
                {poll.length > 2 && (
                  <button type="button" aria-label={`Xóa lựa chọn ${i + 1}`} className="mt-7 grid size-11 place-items-center text-muted" onClick={() => setPoll(poll.filter((_, j) => j !== i))}>
                    <Trash2 size={16} />
                  </button>
                )}
              </div>
            ))}
            <div className="flex justify-between">
              {poll.length < 6 && (
                <button type="button" onClick={() => setPoll([...poll, ""])} className="min-h-11 text-[13px] font-semibold text-primary">
                  + Thêm lựa chọn
                </button>
              )}
              <button type="button" onClick={() => setPoll(null)} className="min-h-11 text-[13px] font-semibold text-expense">
                Bỏ bình chọn
              </button>
            </div>
          </fieldset>
        ))}
      <Toggle label="Cho phép bình luận" checked={allowComments} onChange={setAllowComments} />
      <FormError message={a.error} />
      <div className="grid grid-cols-2 gap-3">
        <Button type="button" variant="secondary" disabled={a.pending} onClick={() => submit(true)}>
          Lưu nháp
        </Button>
        <Button type="submit" disabled={a.pending}>
          {a.pending ? "Đang đăng…" : initial ? "Cập nhật" : "Đăng bài"}
        </Button>
      </div>
      <p className="text-[12px] text-muted">Bài viết hiện ngay. Bài vi phạm Chính sách cộng đồng có thể bị ẩn kèm lý do.</p>
    </form>
  );
}

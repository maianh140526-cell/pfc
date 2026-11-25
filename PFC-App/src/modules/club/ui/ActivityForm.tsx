"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button } from "@/ui";
import { FormError, SelectInput, TextArea, TextInput } from "@/ui/Form";
import { ImageUploader } from "@/ui/ImageUploader";
import { clubPost, useClub } from "../session";

export type ActivityValues = {
  title: string;
  description: string;
  bodyMd: string;
  mode: "offline" | "online" | "hybrid";
  location: string;
  startsAt: string; // local "YYYY-MM-DDTHH:mm"
  endsAt: string;
  registerDeadline: string;
  capacity: string;
  hostTeamId: string;
  cover: string[];
  photos: string[];
};

const EMPTY: ActivityValues = { title: "", description: "", bodyMd: "", mode: "offline", location: "", startsAt: "", endsAt: "", registerDeadline: "", capacity: "", hostTeamId: "", cover: [], photos: [] };

/** Local "YYYY-MM-DDTHH:mm" (Vietnam time) → ISO, and back. */
export const toIso = (local: string) => (local ? new Date(`${local}:00+07:00`).toISOString() : null);
export const toLocal = (iso?: string | null) => (iso ? new Date(new Date(iso).getTime() + 7 * 3600_000).toISOString().slice(0, 16) : "");

/** FR-CLB-007 create / edit a Club activity: required info, cover photo and photo gallery. */
export function ActivityForm({ id, initial }: { id?: string; initial?: ActivityValues }) {
  const router = useRouter();
  const { home, reload } = useClub();
  const [v, setV] = useState<ActivityValues>(initial ?? EMPTY);
  const [state, setState] = useState<{ pending?: "save" | "publish"; error?: string }>({});
  const set = <K extends keyof ActivityValues>(k: K, val: ActivityValues[K]) => setV((x) => ({ ...x, [k]: val }));

  function check(): string | null {
    if (v.title.trim().length < 3) return "Tên hoạt động tối thiểu 3 ký tự.";
    if (v.description.trim().length < 10) return "Mô tả ngắn tối thiểu 10 ký tự.";
    if (!v.startsAt) return "Chọn thời gian bắt đầu.";
    if (v.endsAt && v.endsAt <= v.startsAt) return "Thời gian kết thúc phải sau thời gian bắt đầu.";
    if (v.registerDeadline && v.registerDeadline > v.startsAt) return "Hạn đăng ký phải trước khi bắt đầu.";
    if (v.mode !== "online" && v.location.trim().length < 3) return "Nhập địa điểm.";
    if (v.capacity && (!/^\d+$/.test(v.capacity) || Number(v.capacity) < 1)) return "Số người tối đa phải là số nguyên dương.";
    return null;
  }

  async function submit(publish: boolean) {
    const err = check();
    if (err) return setState({ error: err });
    setState({ pending: publish ? "publish" : "save" });
    const payload = {
      title: v.title.trim(),
      description: v.description.trim(),
      bodyMd: v.bodyMd.trim(),
      kind: "internal",
      mode: v.mode,
      location: v.mode === "online" ? null : v.location.trim(),
      startsAt: toIso(v.startsAt),
      endsAt: toIso(v.endsAt),
      registerDeadline: toIso(v.registerDeadline),
      capacity: v.capacity ? Number(v.capacity) : null,
      hostTeamId: v.hostTeamId || null,
      coverUrl: v.cover[0] ?? null,
      mediaUrls: [...v.cover, ...v.photos.filter((p) => !v.cover.includes(p))],
    };
    try {
      let activityId = id;
      if (id) await clubPost("update_activity", { activityId: id, ...payload });
      else activityId = (await clubPost<{ activityId?: string }>("create_activity", payload)).activityId;
      if (publish && activityId) await clubPost("activity_transition", { activityId, to: "active" });
      await reload();
      router.replace(activityId ? `/club/activities/${activityId}` : "/club/activities");
    } catch (e) {
      setState({ error: e instanceof Error ? e.message : "Lưu hoạt động thất bại." });
    }
  }

  return (
    <form className="space-y-4 px-4 pt-2 pb-6" noValidate onSubmit={(e) => (e.preventDefault(), submit(false))}>
      <ImageUploader purpose="event" max={1} label="Ảnh bìa" hint="Ảnh hiển thị trên thẻ hoạt động." value={v.cover} onChange={(c) => set("cover", c)} />
      <TextInput label="Tên hoạt động / sự kiện" value={v.title} onChange={(e) => set("title", e.target.value)} maxLength={160} />
      <TextArea label="Mô tả ngắn" hint="Tối thiểu 10 ký tự" value={v.description} onChange={(e) => set("description", e.target.value)} maxLength={500} rows={2} />
      <div className="grid grid-cols-2 gap-3">
        <SelectInput label="Hình thức" value={v.mode} onChange={(e) => set("mode", e.target.value as ActivityValues["mode"])}>
          <option value="offline">Trực tiếp</option>
          <option value="online">Trực tuyến</option>
          <option value="hybrid">Kết hợp</option>
        </SelectInput>
        <SelectInput label="Ban phụ trách" value={v.hostTeamId} onChange={(e) => set("hostTeamId", e.target.value)}>
          <option value="">Toàn CLB</option>
          {home.teams.map((t) => (
            <option key={t.id} value={t.id}>
              {t.name}
            </option>
          ))}
        </SelectInput>
      </div>
      {v.mode !== "online" && <TextInput label="Địa điểm" value={v.location} onChange={(e) => set("location", e.target.value)} maxLength={200} />}
      <div className="grid grid-cols-2 gap-3">
        <TextInput label="Bắt đầu" type="datetime-local" value={v.startsAt} onChange={(e) => set("startsAt", e.target.value)} />
        <TextInput label="Kết thúc" type="datetime-local" value={v.endsAt} onChange={(e) => set("endsAt", e.target.value)} />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <TextInput label="Hạn đăng ký" type="datetime-local" value={v.registerDeadline} onChange={(e) => set("registerDeadline", e.target.value)} />
        <TextInput label="Số người tối đa" hint="Trống = không giới hạn" inputMode="numeric" value={v.capacity} onChange={(e) => set("capacity", e.target.value.replace(/\D/g, ""))} />
      </div>
      <TextArea label="Thông tin chi tiết" hint="Chương trình, diễn giả, chuẩn bị, quyền lợi…" value={v.bodyMd} onChange={(e) => set("bodyMd", e.target.value)} maxLength={8000} rows={6} />
      <ImageUploader purpose="event" max={8} label="Ảnh hoạt động" hint="Tối đa 8 ảnh: ảnh poster, hiện trường, tổng kết…" value={v.photos} onChange={(p) => set("photos", p)} />
      <FormError message={state.error} />
      <div className="grid grid-cols-2 gap-2">
        <Button type="submit" variant="secondary" disabled={!!state.pending}>
          {state.pending === "save" ? "Đang lưu…" : "Lưu nháp"}
        </Button>
        <Button disabled={!!state.pending} onClick={() => submit(true)}>
          {state.pending === "publish" ? "Đang đăng…" : id ? "Lưu & công bố" : "Đăng hoạt động"}
        </Button>
      </div>
      <p className="text-[12px] text-muted">Bản nháp chỉ Ban điều hành / Ban Sự kiện thấy. “Đăng hoạt động” hiển thị cho mọi thành viên CLB để đăng ký tham gia.</p>
    </form>
  );
}

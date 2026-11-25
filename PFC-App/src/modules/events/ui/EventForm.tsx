"use client";

import { Plus, Trash2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button } from "@/ui";
import { FormError, SelectInput, TextArea, TextInput, Toggle } from "@/ui/Form";
import { ImageUploader } from "@/ui/ImageUploader";
import { useAction } from "@/ui/use-action";
import { CATEGORIES, MODES, type EventCategory, type EventMode } from "../domain/events";
import { hubFetch } from "@/platform/hub-proxy/client";
import { createEventAction, updateEventAction } from "../server/actions";

type Tk = { name: string; description: string; price: string; capacity: string };
export type EventFormValues = {
  title: string;
  summary: string;
  description: string;
  category: EventCategory;
  mode: EventMode;
  location: string;
  onlineUrl: string;
  startsAt: string;
  endsAt: string;
  deadline: string;
  capacity: string;
  payAtDoor: boolean;
  cover: string[];
  agenda: { time: string; title: string }[];
  speakers: { name: string; title: string }[];
  tickets: Tk[];
};

const EMPTY: EventFormValues = {
  title: "",
  summary: "",
  description: "",
  category: "workshop",
  mode: "offline",
  location: "",
  onlineUrl: "",
  startsAt: "",
  endsAt: "",
  deadline: "",
  capacity: "",
  payAtDoor: false,
  cover: [],
  agenda: [],
  speakers: [],
  tickets: [{ name: "Vé thường", description: "", price: "0", capacity: "" }],
};

/** EVT-05/06 Create / Edit Event. */
export function EventForm({ id, initial, ticketsLocked, onlinePayments, forClub }: { id?: string; initial?: EventFormValues; ticketsLocked?: boolean; onlinePayments: boolean; forClub?: boolean }) {
  const router = useRouter();
  const a = useAction();
  const [v, setV] = useState<EventFormValues>(initial ?? EMPTY);
  const set = <K extends keyof EventFormValues>(k: K, val: EventFormValues[K]) => setV((s) => ({ ...s, [k]: val }));
  const hasPaid = v.tickets.some((t) => Number(t.price) > 0);
  const payload = () => ({
    title: v.title,
    summary: v.summary,
    description: v.description,
    category: v.category,
    mode: v.mode,
    location: v.location,
    onlineUrl: v.onlineUrl,
    startsAt: v.startsAt,
    endsAt: v.endsAt,
    deadline: v.deadline || null,
    capacity: v.capacity,
    payAtDoor: v.payAtDoor,
    coverUrl: v.cover[0] ?? null,
    agenda: v.agenda.filter((x) => x.title.trim()),
    speakers: v.speakers.filter((x) => x.name.trim()),
    tickets: v.tickets.map((t) => ({ name: t.name, description: t.description, price: Number(t.price.replace(/\D/g, "") || 0), capacity: t.capacity })),
  });
  return (
    <form
      className="space-y-4 px-4 pt-2 pb-6"
      noValidate
      onSubmit={(e) => {
        e.preventDefault();
        if (id) a.run(() => updateEventAction(id, payload()), () => router.replace(`/events/${id}`));
        else
          a.run(
            () => createEventAction(payload()),
            async (eid) => {
              // Created from the Club: link it so it shows in Câu lạc bộ → Hoạt động → Sự kiện.
              if (forClub) {
                await hubFetch("club", "", { method: "POST", headers: { "idempotency-key": `pfc-link-${eid}` }, json: { action: "link_event", externalEventId: eid, label: v.title.trim() } }).catch(() => undefined);
              }
              router.replace(`/events/${eid}`);
            },
          );
      }}
    >
      <TextInput label="Tên sự kiện" value={v.title} onChange={(e) => set("title", e.target.value)} maxLength={120} />
      <TextInput label="Mô tả ngắn" hint="Hiện trên thẻ sự kiện" value={v.summary} onChange={(e) => set("summary", e.target.value)} maxLength={200} />
      <div className="grid grid-cols-2 gap-3">
        <SelectInput label="Loại" value={v.category} onChange={(e) => set("category", e.target.value as EventCategory)}>
          {Object.entries(CATEGORIES).map(([k, l]) => (
            <option key={k} value={k}>
              {l}
            </option>
          ))}
        </SelectInput>
        <SelectInput label="Hình thức" value={v.mode} onChange={(e) => set("mode", e.target.value as EventMode)}>
          {Object.entries(MODES).map(([k, l]) => (
            <option key={k} value={k}>
              {l}
            </option>
          ))}
        </SelectInput>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <TextInput label="Bắt đầu" type="datetime-local" value={v.startsAt} onChange={(e) => set("startsAt", e.target.value)} />
        <TextInput label="Kết thúc" type="datetime-local" value={v.endsAt} onChange={(e) => set("endsAt", e.target.value)} />
      </div>
      <TextInput label="Hạn đăng ký" hint="Bỏ trống = đến lúc bắt đầu" type="datetime-local" value={v.deadline} onChange={(e) => set("deadline", e.target.value)} />
      {v.mode !== "online" && <TextInput label="Địa điểm" value={v.location} onChange={(e) => set("location", e.target.value)} maxLength={200} />}
      {v.mode !== "offline" && <TextInput label="Link tham gia (https://)" hint="Chỉ người đã đăng ký mới thấy" type="url" value={v.onlineUrl} onChange={(e) => set("onlineUrl", e.target.value)} />}
      <TextInput label="Sức chứa tối đa" hint="Bỏ trống = không giới hạn" inputMode="numeric" value={v.capacity} onChange={(e) => set("capacity", e.target.value.replace(/\D/g, ""))} />
      <TextArea label="Giới thiệu chi tiết" value={v.description} onChange={(e) => set("description", e.target.value)} maxLength={8000} />
      <ImageUploader purpose="event" max={1} label="Ảnh bìa" hint="Không bắt buộc." value={v.cover} onChange={(cover) => set("cover", cover)} />

      <fieldset className="space-y-3">
        <legend className="text-[15px] font-bold text-ink">Loại vé</legend>
        {ticketsLocked && <p className="text-[12px] text-muted">Đã có người đăng ký nên không đổi được loại vé.</p>}
        {v.tickets.map((t, i) => (
          <div key={i} className="space-y-2 rounded-xl border border-line p-3">
            <div className="flex gap-2">
              <div className="flex-1">
                <TextInput label="Tên vé" value={t.name} disabled={ticketsLocked} onChange={(e) => set("tickets", v.tickets.map((x, j) => (j === i ? { ...x, name: e.target.value } : x)))} maxLength={60} />
              </div>
              {v.tickets.length > 1 && !ticketsLocked && (
                <button type="button" aria-label="Xóa loại vé" className="mt-7 grid size-11 place-items-center rounded-full text-expense" onClick={() => set("tickets", v.tickets.filter((_, j) => j !== i))}>
                  <Trash2 size={18} />
                </button>
              )}
            </div>
            <div className="grid grid-cols-2 gap-2">
              <TextInput label="Giá (₫, 0 = miễn phí)" inputMode="numeric" value={t.price} disabled={ticketsLocked} onChange={(e) => set("tickets", v.tickets.map((x, j) => (j === i ? { ...x, price: e.target.value.replace(/\D/g, "") } : x)))} />
              <TextInput label="Số lượng" hint="Trống = không giới hạn" inputMode="numeric" value={t.capacity} disabled={ticketsLocked} onChange={(e) => set("tickets", v.tickets.map((x, j) => (j === i ? { ...x, capacity: e.target.value.replace(/\D/g, "") } : x)))} />
            </div>
          </div>
        ))}
        {v.tickets.length < 6 && !ticketsLocked && (
          <Button variant="ghost" onClick={() => set("tickets", [...v.tickets, { name: "", description: "", price: "0", capacity: "" }])}>
            <Plus size={18} /> Thêm loại vé
          </Button>
        )}
        {hasPaid && (
          <Toggle
            checked={v.payAtDoor}
            onChange={(x) => set("payAtDoor", x)}
            label="Thu tiền tại quầy"
            description={onlinePayments ? "Tắt = người tham dự thanh toán qua VNPAY khi đăng ký." : "Cổng VNPAY chưa bật: vé có phí cần thu tại quầy."}
          />
        )}
      </fieldset>

      <fieldset className="space-y-2">
        <legend className="text-[15px] font-bold text-ink">Chương trình</legend>
        {v.agenda.map((x, i) => (
          <div key={i} className="grid grid-cols-[90px_1fr] gap-2">
            <TextInput label="Giờ" value={x.time} onChange={(e) => set("agenda", v.agenda.map((y, j) => (j === i ? { ...y, time: e.target.value } : y)))} maxLength={20} placeholder="09:00" />
            <TextInput label="Nội dung" value={x.title} onChange={(e) => set("agenda", v.agenda.map((y, j) => (j === i ? { ...y, title: e.target.value } : y)))} maxLength={120} />
          </div>
        ))}
        {v.agenda.length < 20 && (
          <Button variant="ghost" onClick={() => set("agenda", [...v.agenda, { time: "", title: "" }])}>
            <Plus size={18} /> Thêm mục
          </Button>
        )}
      </fieldset>

      <fieldset className="space-y-2">
        <legend className="text-[15px] font-bold text-ink">Diễn giả</legend>
        {v.speakers.map((x, i) => (
          <div key={i} className="grid grid-cols-2 gap-2">
            <TextInput label="Họ tên" value={x.name} onChange={(e) => set("speakers", v.speakers.map((y, j) => (j === i ? { ...y, name: e.target.value } : y)))} maxLength={80} />
            <TextInput label="Chức danh" value={x.title} onChange={(e) => set("speakers", v.speakers.map((y, j) => (j === i ? { ...y, title: e.target.value } : y)))} maxLength={120} />
          </div>
        ))}
        {v.speakers.length < 20 && (
          <Button variant="ghost" onClick={() => set("speakers", [...v.speakers, { name: "", title: "" }])}>
            <Plus size={18} /> Thêm diễn giả
          </Button>
        )}
      </fieldset>

      <FormError message={a.error} />
      <Button type="submit" block disabled={a.pending}>
        {a.pending ? "Đang lưu…" : id ? "Lưu thay đổi" : "Lưu bản nháp"}
      </Button>
      {!id && <p className="text-[12px] text-muted">Sau khi lưu, bấm “Gửi duyệt” để Ban Sự kiện xem xét trước khi công khai.</p>}
    </form>
  );
}

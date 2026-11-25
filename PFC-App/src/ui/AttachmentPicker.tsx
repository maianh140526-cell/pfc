"use client";

import { Camera, FileText, Loader2, Paperclip, X } from "lucide-react";
import { useRef, useState } from "react";

export type AttachmentValue = { url: string; name: string };

const isImage = (url: string) => url.endsWith(".webp");

/**
 * Attach photos and files to a document / quiz. "Chụp ảnh" opens the phone camera, "Chọn tệp" the file picker
 * (photos, PDF, Word, Excel, PowerPoint, TXT/CSV). Each file goes to /api/uploads (purpose "attachment"), where the
 * server checks the real type, strips photo metadata and refuses macros; the form keeps only the returned URLs.
 */
export function AttachmentPicker({
  value,
  onChange,
  max = 10,
  label = "Ảnh và tệp đính kèm",
  hint = "Chụp trang bài tập hoặc chọn tệp PDF, Word, Excel, PowerPoint, TXT. Tối đa 4 MB mỗi tệp (ảnh 8 MB).",
}: {
  value: AttachmentValue[];
  onChange: (v: AttachmentValue[]) => void;
  max?: number;
  label?: string;
  hint?: string;
}) {
  const camera = useRef<HTMLInputElement>(null);
  const picker = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const items = useRef(value);
  items.current = value;

  async function upload(files: FileList | null) {
    if (!files?.length) return;
    setError(null);
    const room = max - items.current.length;
    if (files.length > room) setError(`Tối đa ${max} tệp / ảnh.`);
    for (const f of [...files].slice(0, Math.max(0, room))) {
      setBusy((n) => n + 1);
      try {
        const body = new FormData();
        body.set("purpose", "attachment");
        body.set("file", f);
        const res = await fetch("/api/uploads", { method: "POST", body });
        const data = (await res.json().catch(() => ({}))) as { url?: string; name?: string; error?: string };
        if (!res.ok || !data.url) setError(data.error ?? "Không tải được tệp.");
        else onChange((items.current = [...items.current, { url: data.url, name: data.name || f.name }]));
      } catch {
        setError("Không kết nối được máy chủ. Kiểm tra mạng và thử lại.");
      } finally {
        setBusy((n) => n - 1);
      }
    }
    if (camera.current) camera.current.value = "";
    if (picker.current) picker.current.value = "";
  }

  const full = value.length >= max;
  return (
    <div>
      <p className="mb-1.5 text-[14px] font-semibold text-ink">
        {label} <span className="font-normal text-muted">({value.length}/{max})</span>
      </p>
      {value.length > 0 && (
        <ul className="mb-2 space-y-2">
          {value.map((a) => (
            <li key={a.url} className="flex items-center gap-3 rounded-xl border border-line bg-surface p-2">
              {isImage(a.url) ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={a.url} alt="" className="size-12 shrink-0 rounded-lg object-cover" />
              ) : (
                <span className="grid size-12 shrink-0 place-items-center rounded-lg bg-primary-soft text-primary">
                  <FileText size={22} />
                </span>
              )}
              <a href={a.url} target="_blank" rel="noopener noreferrer" className="min-w-0 flex-1 truncate text-[14px] font-semibold text-primary">
                {a.name || "Tệp đính kèm"}
              </a>
              <button type="button" aria-label={`Bỏ ${a.name || "tệp"}`} className="grid size-11 shrink-0 place-items-center text-muted" onClick={() => onChange(value.filter((x) => x.url !== a.url))}>
                <X size={18} />
              </button>
            </li>
          ))}
        </ul>
      )}
      <div className="grid grid-cols-2 gap-2">
        <button
          type="button"
          disabled={full || busy > 0}
          onClick={() => camera.current?.click()}
          className="pressable flex min-h-12 items-center justify-center gap-2 rounded-xl border-2 border-dashed border-line text-[14px] font-semibold text-primary disabled:opacity-50"
        >
          <Camera size={18} /> Chụp ảnh
        </button>
        <button
          type="button"
          disabled={full || busy > 0}
          onClick={() => picker.current?.click()}
          className="pressable flex min-h-12 items-center justify-center gap-2 rounded-xl border-2 border-dashed border-line text-[14px] font-semibold text-primary disabled:opacity-50"
        >
          {busy > 0 ? <Loader2 size={18} className="animate-spin" /> : <Paperclip size={18} />} {busy > 0 ? "Đang tải…" : "Chọn tệp"}
        </button>
      </div>
      <input ref={camera} type="file" accept="image/*" capture="environment" className="sr-only" tabIndex={-1} aria-hidden="true" onChange={(e) => upload(e.target.files)} />
      <input
        ref={picker}
        type="file"
        multiple
        accept="image/jpeg,image/png,image/webp,application/pdf,.pdf,.docx,.xlsx,.pptx,.txt,.csv"
        className="sr-only"
        tabIndex={-1}
        aria-hidden="true"
        onChange={(e) => upload(e.target.files)}
      />
      <p className="mt-1.5 text-[12px] text-muted">{hint}</p>
      {error && (
        <p role="alert" className="mt-1.5 text-[13px] text-expense">
          {error}
        </p>
      )}
    </div>
  );
}

/** Read-only list of attachments for detail pages: photos as thumbnails, files as download rows. */
export function AttachmentList({ items }: { items: { id?: string; url: string; name: string; kind?: "image" | "file" }[] }) {
  if (!items.length) return null;
  const photos = items.filter((a) => (a.kind ? a.kind === "image" : isImage(a.url)));
  const files = items.filter((a) => !photos.includes(a));
  return (
    <div className="space-y-2">
      {photos.length > 0 && (
        <ul className="grid grid-cols-3 gap-2">
          {photos.map((a) => (
            <li key={a.url}>
              <a href={a.url} target="_blank" rel="noopener noreferrer" className="block overflow-hidden rounded-xl border border-line">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={a.url} alt={a.name || "Ảnh đính kèm"} className="aspect-square w-full object-cover" loading="lazy" />
              </a>
            </li>
          ))}
        </ul>
      )}
      {files.map((a) => (
        <a key={a.url} href={a.url} target="_blank" rel="noopener noreferrer" className="pressable flex items-center gap-3 rounded-xl border border-line bg-surface px-3 py-2.5">
          <span className="grid size-10 shrink-0 place-items-center rounded-lg bg-primary-soft text-primary">
            <FileText size={20} />
          </span>
          <span className="min-w-0 flex-1 truncate text-[14px] font-semibold text-ink">{a.name || "Tệp đính kèm"}</span>
          <span className="text-[12px] font-semibold text-primary">Tải về</span>
        </a>
      ))}
    </div>
  );
}

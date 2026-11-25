"use client";

import { ImagePlus, Loader2, X } from "lucide-react";
import { useId, useRef, useState } from "react";
import { cx } from "./cx";

type Purpose = "listing" | "avatar" | "post" | "project" | "event" | "place" | "club" | "opportunity";

/**
 * Photo picker for forms (mobile: opens camera roll / camera). Each file is uploaded right away to
 * /api/uploads, where the server checks, resizes and strips location data; the form only keeps the
 * returned URLs, and the server re-checks that they belong to the member on save.
 */
export function ImageUploader({
  value,
  onChange,
  purpose,
  max = 6,
  label = "Ảnh",
  hint = "JPG, PNG hoặc WebP, tối đa 8 MB. Ảnh đầu tiên là ảnh bìa.",
}: {
  value: string[];
  onChange: (urls: string[]) => void;
  purpose: Purpose;
  max?: number;
  label?: string;
  hint?: string;
}) {
  const inputId = useId();
  const input = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const urls = useRef(value);
  urls.current = value;

  async function upload(files: FileList | null) {
    if (!files?.length) return;
    setError(null);
    const room = max - urls.current.length;
    const picked = [...files].slice(0, Math.max(0, room));
    if (files.length > room) setError(`Tối đa ${max} ảnh.`);
    for (const f of picked) {
      if (f.size > 8 * 1024 * 1024) {
        setError(`“${f.name}” lớn hơn 8 MB.`);
        continue;
      }
      setBusy((n) => n + 1);
      try {
        const body = new FormData();
        body.set("purpose", purpose);
        body.set("file", f);
        const res = await fetch("/api/uploads", { method: "POST", body });
        const data = (await res.json().catch(() => ({}))) as { url?: string; error?: string };
        if (!res.ok || !data.url) setError(data.error ?? "Không tải được ảnh.");
        else onChange((urls.current = [...urls.current, data.url]));
      } catch {
        setError("Không kết nối được máy chủ. Kiểm tra mạng và thử lại.");
      } finally {
        setBusy((n) => n - 1);
      }
    }
    if (input.current) input.current.value = "";
  }

  return (
    <div>
      <label htmlFor={inputId} className="mb-1.5 block text-[14px] font-semibold text-ink">
        {label} <span className="font-normal text-muted">({value.length}/{max})</span>
      </label>
      <ul className="grid grid-cols-3 gap-2">
        {value.map((u, i) => (
          <li key={u} className="relative aspect-square overflow-hidden rounded-2xl border border-line bg-surface-2">
            {/* eslint-disable-next-line @next/next/no-img-element -- server-processed upload, already sized */}
            <img src={u} alt={i === 0 ? "Ảnh bìa" : `Ảnh ${i + 1}`} className="size-full object-cover" loading="lazy" />
            {i === 0 && <span className="absolute bottom-1 left-1 rounded-full bg-primary px-2 py-0.5 text-[11px] font-semibold text-on-primary">Ảnh bìa</span>}
            <button
              type="button"
              aria-label={`Xóa ảnh ${i + 1}`}
              onClick={() => onChange(value.filter((x) => x !== u))}
              className="absolute top-1 right-1 grid size-8 place-items-center rounded-full bg-ink/70 text-surface"
            >
              <X size={16} />
            </button>
            {i > 0 && (
              <button
                type="button"
                onClick={() => onChange([u, ...value.filter((x) => x !== u)])}
                className="absolute bottom-1 left-1 rounded-full bg-surface/90 px-2 py-0.5 text-[11px] font-semibold text-ink"
              >
                Đặt làm bìa
              </button>
            )}
          </li>
        ))}
        {Array.from({ length: busy }, (_, i) => (
          <li key={`busy-${i}`} className="grid aspect-square place-items-center rounded-2xl border border-dashed border-line text-muted" aria-label="Đang tải ảnh">
            <Loader2 size={24} className="animate-spin" />
          </li>
        ))}
        {value.length + busy < max && (
          <li>
            <label
              htmlFor={inputId}
              className={cx("pressable grid aspect-square cursor-pointer place-items-center rounded-2xl border border-dashed border-primary bg-primary-soft text-primary")}
            >
              <span className="flex flex-col items-center gap-1 text-[12px] font-semibold">
                <ImagePlus size={26} /> Thêm ảnh
              </span>
            </label>
          </li>
        )}
      </ul>
      <input
        ref={input}
        id={inputId}
        type="file"
        accept="image/jpeg,image/png,image/webp"
        multiple={max > 1}
        className="sr-only"
        onChange={(e) => upload(e.target.files)}
      />
      {error ? <p className="mt-1.5 text-[13px] text-expense" role="alert">{error}</p> : <p className="mt-1.5 text-[12px] text-muted">{hint}</p>}
    </div>
  );
}

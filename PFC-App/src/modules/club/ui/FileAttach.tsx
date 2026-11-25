"use client";

import { FileText, Image as ImageIcon, Paperclip, Trash2 } from "lucide-react";
import { useRef, useState } from "react";
import type { TaskAttachment } from "../types";

export type UploadedFile = { name: string; url: string; mimeType: string; sizeBytes: number };

const MAX_PDF = 4 * 1024 * 1024;
const MAX_IMG = 8 * 1024 * 1024;

/**
 * Uploads one file to PFC App storage: PDF → checked document, image → re-encoded WebP (metadata removed).
 * Returns what the Club task stores (link + name + type + size).
 */
export async function uploadClubFile(f: File): Promise<UploadedFile> {
  const isPdf = f.type === "application/pdf" || /\.pdf$/i.test(f.name);
  const isImg = /^image\/(jpeg|png|webp|heic|heif)$/.test(f.type);
  if (!isPdf && !isImg) throw new Error("Chỉ đính kèm được PDF hoặc ảnh (JPG, PNG, WebP).");
  if (f.size > (isPdf ? MAX_PDF : MAX_IMG)) throw new Error(isPdf ? "PDF tối đa 4 MB." : "Ảnh tối đa 8 MB.");
  const fd = new FormData();
  fd.set("purpose", isPdf ? "document" : "club");
  fd.set("file", f);
  const res = await fetch("/api/uploads", { method: "POST", body: fd });
  const j = (await res.json().catch(() => ({}))) as { url?: string; error?: string };
  if (!res.ok || !j.url) throw new Error(j.error ?? "Không tải được tệp.");
  return { name: f.name.slice(0, 120), url: j.url, mimeType: isPdf ? "application/pdf" : "image/webp", sizeBytes: f.size };
}

const kb = (n: number) => (n >= 1024 * 1024 ? `${(n / 1024 / 1024).toFixed(1)} MB` : `${Math.max(1, Math.round(n / 1024))} KB`);

/** List of attachments with optional remove buttons. */
export function AttachmentList({ items, canRemove, onRemove, busy }: { items: Array<TaskAttachment | (UploadedFile & { id?: string })>; canRemove?: (a: TaskAttachment | UploadedFile) => boolean; onRemove?: (index: number) => void; busy?: boolean }) {
  if (!items.length) return null;
  return (
    <ul className="divide-y divide-line overflow-hidden rounded-[var(--radius-card)] border border-line bg-surface">
      {items.map((a, i) => {
        const pdf = a.mimeType === "application/pdf";
        const Icon = pdf ? FileText : ImageIcon;
        return (
          <li key={("id" in a && a.id) || a.url} className="flex items-center gap-3 px-3 py-2.5">
            <Icon size={20} className="shrink-0 text-primary" />
            <a href={a.url} target="_blank" rel="noopener noreferrer" className="min-w-0 flex-1">
              <span className="block truncate text-[14px] font-semibold text-primary">{a.name}</span>
              <span className="block text-[12px] text-muted">
                {pdf ? "PDF" : "Ảnh"} · {kb(a.sizeBytes)}
                {"uploaderName" in a && a.uploaderName ? ` · ${a.uploaderName}` : ""}
              </span>
            </a>
            {onRemove && (!canRemove || canRemove(a)) && (
              <button type="button" aria-label={`Xóa ${a.name}`} disabled={busy} onClick={() => onRemove(i)} className="grid size-11 place-items-center text-muted">
                <Trash2 size={18} />
              </button>
            )}
          </li>
        );
      })}
    </ul>
  );
}

/** "Đính kèm tệp" button: picks one or more files, uploads each, then calls onUploaded. */
export function AttachButton({ onUploaded, disabled, label = "Đính kèm tệp (PDF, ảnh)" }: { onUploaded: (f: UploadedFile) => Promise<void> | void; disabled?: boolean; label?: string }) {
  const input = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  return (
    <div>
      <button
        type="button"
        disabled={disabled || busy}
        onClick={() => input.current?.click()}
        className="flex min-h-12 w-full items-center justify-center gap-2 rounded-xl border-2 border-dashed border-line text-[14px] font-semibold text-primary disabled:opacity-50"
      >
        <Paperclip size={18} /> {busy ? "Đang tải lên…" : label}
      </button>
      <input
        ref={input}
        type="file"
        multiple
        accept="application/pdf,.pdf,image/jpeg,image/png,image/webp"
        className="sr-only"
        tabIndex={-1}
        aria-hidden="true"
        onChange={async (e) => {
          const files = [...(e.target.files ?? [])];
          if (input.current) input.current.value = "";
          setError(null);
          setBusy(true);
          try {
            for (const f of files) await onUploaded(await uploadClubFile(f));
          } catch (err) {
            setError(err instanceof Error ? err.message : "Không tải được tệp.");
          } finally {
            setBusy(false);
          }
        }}
      />
      {error && (
        <p role="alert" className="mt-1.5 text-[13px] text-expense">
          {error}
        </p>
      )}
      <p className="mt-1 text-[12px] text-muted">PDF tối đa 4 MB, ảnh tối đa 8 MB; tối đa 10 tệp mỗi công việc.</p>
    </div>
  );
}

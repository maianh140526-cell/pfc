"use client";

import { FileText, Upload, X } from "lucide-react";
import { useRef, useState } from "react";
import { cx } from "./cx";

/** Upload one PDF (≤ 4 MB) to /api/uploads (purpose "document"); the server checks type, size and active content. */
export function DocumentUploader({ value, onChange, label = "Tệp PDF" }: { value: string | null; onChange: (url: string | null) => void; label?: string }) {
  const input = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [name, setName] = useState<string | null>(null);

  async function upload(files: FileList | null) {
    const f = files?.[0];
    if (!f) return;
    setError(null);
    if (f.type && f.type !== "application/pdf") return setError("Chỉ nhận tệp PDF.");
    if (f.size > 4 * 1024 * 1024) return setError("Tệp PDF tối đa 4 MB. Tệp lớn hơn: dán link Google Drive.");
    setBusy(true);
    try {
      const fd = new FormData();
      fd.set("purpose", "document");
      fd.set("file", f);
      const res = await fetch("/api/uploads", { method: "POST", body: fd });
      const j = (await res.json().catch(() => ({}))) as { url?: string; error?: string };
      if (!res.ok || !j.url) throw new Error(j.error ?? "Không tải được tệp.");
      setName(f.name);
      onChange(j.url);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Không tải được tệp.");
    } finally {
      setBusy(false);
      if (input.current) input.current.value = "";
    }
  }

  return (
    <div>
      <p className="mb-1.5 text-[13px] font-semibold text-ink-2">{label}</p>
      {value ? (
        <div className="flex items-center gap-3 rounded-xl border border-line bg-surface px-4 py-3">
          <FileText size={22} className="shrink-0 text-primary" />
          <a href={value} target="_blank" rel="noopener noreferrer" className="min-w-0 flex-1 truncate text-[14px] font-semibold text-primary">
            {name ?? "Xem tệp đã tải lên"}
          </a>
          <button type="button" aria-label="Bỏ tệp" className="grid size-11 place-items-center text-muted" onClick={() => onChange(null)}>
            <X size={18} />
          </button>
        </div>
      ) : (
        <button
          type="button"
          disabled={busy}
          onClick={() => input.current?.click()}
          className={cx("flex min-h-14 w-full items-center justify-center gap-2 rounded-xl border-2 border-dashed border-line text-[14px] font-semibold text-primary", busy && "opacity-60")}
        >
          <Upload size={18} /> {busy ? "Đang tải lên…" : "Chọn tệp PDF (tối đa 4 MB)"}
        </button>
      )}
      <input ref={input} type="file" accept="application/pdf,.pdf" className="sr-only" tabIndex={-1} aria-hidden="true" onChange={(e) => upload(e.target.files)} />
      {error && (
        <p role="alert" className="mt-1.5 text-[13px] text-expense">
          {error}
        </p>
      )}
    </div>
  );
}

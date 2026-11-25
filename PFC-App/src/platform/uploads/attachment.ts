/**
 * Pure checks for study / listing files (no I/O). Never trusts the file name or Content-Type: the type comes from
 * the bytes. Accepted: PDF (checked in service.ts), Word / Excel / PowerPoint (OOXML, no macros), plain text / CSV.
 * Refused: legacy .doc/.xls/.ppt (can carry macros), macro-enabled files, archives, scripts, executables.
 */
export const MAX_ATTACHMENT_BYTES = 4 * 1024 * 1024;

export type FileExt = "pdf" | "docx" | "xlsx" | "pptx" | "txt" | "csv";
export type FileKind = { ext: FileExt; mime: string };

export const FILE_MIME: Record<FileExt, string> = {
  pdf: "application/pdf",
  docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  xlsx: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  pptx: "application/vnd.openxmlformats-officedocument.presentationml.presentation",
  txt: "text/plain; charset=utf-8",
  csv: "text/csv; charset=utf-8",
};

const OOXML: Array<{ ext: "docx" | "xlsx" | "pptx"; dir: string }> = [
  { ext: "docx", dir: "word/" },
  { ext: "xlsx", dir: "xl/" },
  { ext: "pptx", dir: "ppt/" },
];

const UNSUPPORTED = "Chỉ nhận PDF, Word (.docx), Excel (.xlsx), PowerPoint (.pptx), văn bản (.txt, .csv) và ảnh.";

export type Detected = { kind: FileKind } | { error: string };

/** Sniffs a non-PDF, non-image file. PDF is detected by the caller (it needs the deeper active-content check). */
export function detectOfficeOrText(buf: Buffer, fileName: string): Detected {
  if (buf.length === 0) return { error: "Tệp rỗng." };
  if (buf.length > MAX_ATTACHMENT_BYTES) return { error: "Tệp tối đa 4 MB. Tệp lớn hơn: dán link Google Drive." };
  if (buf[0] === 0x50 && buf[1] === 0x4b && buf[2] === 0x03 && buf[3] === 0x04) {
    const text = buf.toString("latin1");
    if (!text.includes("[Content_Types].xml")) return { error: UNSUPPORTED };
    if (/vbaProject\.bin|macroEnabled/i.test(text)) return { error: "Không nhận tệp có macro." };
    const hit = OOXML.find((o) => text.includes(o.dir));
    if (!hit) return { error: UNSUPPORTED };
    return { kind: { ext: hit.ext, mime: FILE_MIME[hit.ext] } };
  }
  if (buf.includes(0)) return { error: UNSUPPORTED };
  try {
    new TextDecoder("utf-8", { fatal: true }).decode(buf);
  } catch {
    return { error: "Tệp văn bản phải mã hóa UTF-8." };
  }
  const ext: FileExt = /\.csv$/i.test(fileName) ? "csv" : "txt";
  return { kind: { ext, mime: FILE_MIME[ext] } };
}

/** A file name safe to show in the UI (no path, no control characters). */
export function cleanFileName(raw: string): string {
  const base = (raw.split(/[\\/]/).pop() ?? "").replace(/[\u0000-\u001f<>"|?*]/g, "").trim();
  return base.slice(0, 120) || "tai-lieu";
}

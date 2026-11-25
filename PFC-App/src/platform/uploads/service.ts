import "server-only";
import { randomUUID } from "node:crypto";
import { all, run } from "@/platform/db/client";
import { audit } from "@/platform/audit";
import { ActionError } from "@/platform/errors";
import { allowAttempt } from "@/platform/rate-limit";
import type { Actor } from "@/platform/roles";
import { cleanFileName, detectOfficeOrText, MAX_ATTACHMENT_BYTES } from "./attachment";
import { ImageRejected, processImage, sniffImage } from "./image";
import { putObject } from "./storage";

/** Image purposes. "document" is the one non-image purpose (PDF, see saveDocument). */
export const UPLOAD_PURPOSES = ["listing", "avatar", "post", "project", "event", "place", "club", "document", "attachment", "opportunity"] as const;
export type UploadPurpose = (typeof UPLOAD_PURPOSES)[number];
export type Upload = { id: string; url: string; width: number; height: number; kind?: "image" | "file"; name?: string };

/** Vercel functions accept ~4.5 MB request bodies, so documents stay under 4 MB (bigger files: share a link). */
export const MAX_DOCUMENT_BYTES = 4 * 1024 * 1024;

/**
 * Pure check for an uploaded PDF: real PDF header, size, and no active content (JavaScript, launch actions,
 * embedded files). Returns an error message or null.
 */
export function checkPdf(buf: Buffer): string | null {
  if (buf.length === 0) return "Tệp rỗng.";
  if (buf.length > MAX_DOCUMENT_BYTES) return "Tệp PDF tối đa 4 MB. Tệp lớn hơn: chia sẻ bằng link.";
  if (buf.subarray(0, 5).toString("latin1") !== "%PDF-") return "Chỉ nhận tệp PDF.";
  const text = buf.toString("latin1");
  if (/\/(JavaScript|JS|Launch|EmbeddedFile|RichMedia|XFA)\b/.test(text)) return "PDF chứa mã chạy tự động hoặc tệp đính kèm, không được phép tải lên.";
  if (!/%%EOF\s*$/.test(text.slice(-1024))) return "Tệp PDF bị hỏng hoặc không đầy đủ.";
  return null;
}

/** Stores one PDF for the signed-in member (Học tập documents). 20 / hour / member. */
export async function saveDocument(actor: Actor, input: Buffer): Promise<Upload> {
  if (!(await allowAttempt(`upload-doc:${actor.id}`, 20, 60 * 60_000))) throw new ActionError("Bạn tải tài liệu quá nhiều. Vui lòng thử lại sau.", "rate_limited");
  const err = checkPdf(input);
  if (err) throw new ActionError(err, "invalid_document");
  const id = randomUUID();
  const key = `document/${id}.pdf`;
  const url = await putObject(key, input, "application/pdf");
  await run("INSERT INTO uploads (id, owner_id, purpose, mime, bytes, width, height, storage_key, url, created_at) VALUES (?, ?, 'document', 'application/pdf', ?, NULL, NULL, ?, ?, ?)", [
    id,
    actor.id,
    input.length,
    key,
    url,
    new Date().toISOString(),
  ]);
  await audit(actor.id, "upload.document", `upload:${id}`, "success");
  return { id, url, width: 0, height: 0 };
}

/** Is this URL one of the actor's own uploaded documents? */
export async function isOwnDocument(actor: Actor, url: string): Promise<boolean> {
  return (await all("SELECT 1 AS x FROM uploads WHERE owner_id = ? AND purpose = 'document' AND url = ?", [actor.id, url])).length > 0;
}

/**
 * One study / listing file: a photo (re-encoded, metadata stripped) or a PDF / Word / Excel / PowerPoint / text file
 * checked by its bytes. Photos taken with the phone camera arrive here too. 40 files / hour / member.
 */
export async function saveAttachment(actor: Actor, input: Buffer, fileName: string): Promise<Upload> {
  const name = cleanFileName(fileName);
  if (sniffImage(input)) {
    const up = await saveImage(actor, "attachment", input);
    return { ...up, kind: "image", name };
  }
  if (!(await allowAttempt(`upload-file:${actor.id}`, 40, 60 * 60_000))) throw new ActionError("Bạn tải tệp quá nhiều. Vui lòng thử lại sau.", "rate_limited");
  let ext: string;
  let mime: string;
  if (input.subarray(0, 5).toString("latin1") === "%PDF-") {
    const err = checkPdf(input);
    if (err) throw new ActionError(err, "invalid_document");
    ext = "pdf";
    mime = "application/pdf";
  } else {
    if (input.length > MAX_ATTACHMENT_BYTES) throw new ActionError("Tệp tối đa 4 MB. Tệp lớn hơn: dán link Google Drive.", "invalid_document");
    const d = detectOfficeOrText(input, name);
    if ("error" in d) throw new ActionError(d.error, "invalid_document");
    ext = d.kind.ext;
    mime = d.kind.mime.split(";")[0];
  }
  const id = randomUUID();
  const key = `attachment/${id}.${ext}`;
  const url = await putObject(key, input, mime);
  await run("INSERT INTO uploads (id, owner_id, purpose, mime, bytes, width, height, storage_key, url, created_at) VALUES (?, ?, 'attachment', ?, ?, NULL, NULL, ?, ?, ?)", [
    id,
    actor.id,
    mime,
    input.length,
    key,
    url,
    new Date().toISOString(),
  ]);
  await audit(actor.id, "upload.attachment", `upload:${id}`, "success");
  return { id, url, width: 0, height: 0, kind: "file", name };
}

/** Is this URL one of the actor's own uploaded files (attachment or PDF document)? */
export async function isOwnAttachment(actor: Actor, url: string): Promise<boolean> {
  return (await all("SELECT 1 AS x FROM uploads WHERE owner_id = ? AND purpose IN ('attachment','document') AND url = ?", [actor.id, url])).length > 0;
}

/** Validates, cleans and stores one image for the signed-in member. 60 uploads / hour / member. */
export async function saveImage(actor: Actor, purpose: UploadPurpose, input: Buffer): Promise<Upload> {
  if (!(await allowAttempt(`upload:${actor.id}`, 60, 60 * 60_000))) throw new ActionError("Bạn tải ảnh quá nhiều. Vui lòng thử lại sau.", "rate_limited");
  let img;
  try {
    img = await processImage(input, { square: purpose === "avatar" });
  } catch (err) {
    if (err instanceof ImageRejected) throw new ActionError(err.message, "invalid_image");
    throw err;
  }
  const id = randomUUID();
  const key = `${purpose}/${id}.webp`;
  const url = await putObject(key, img.data, img.mime);
  await run("INSERT INTO uploads (id, owner_id, purpose, mime, bytes, width, height, storage_key, url, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)", [
    id,
    actor.id,
    purpose,
    img.mime,
    img.data.length,
    img.width,
    img.height,
    key,
    url,
    new Date().toISOString(),
  ]);
  await audit(actor.id, "upload.create", `upload:${id}`, "success");
  return { id, url, width: img.width, height: img.height };
}

/**
 * Turns upload ids sent by a form into URLs, accepting only the actor's own uploads for that purpose.
 * A form can therefore never attach someone else's file or an arbitrary external URL.
 */
export async function ownUploadUrls(actor: Actor, purpose: UploadPurpose, ids: unknown, max: number): Promise<string[]> {
  if (!Array.isArray(ids) || ids.length === 0) return [];
  if (ids.length > max) throw new ActionError(`Tối đa ${max} ảnh.`);
  const clean = ids.filter((x): x is string => typeof x === "string" && /^[0-9a-f-]{36}$/.test(x));
  if (clean.length !== ids.length) throw new ActionError("Ảnh không hợp lệ.");
  const rows = await all<{ id: string; url: string }>(
    `SELECT id, url FROM uploads WHERE owner_id = ? AND purpose = ? AND id IN (${clean.map(() => "?").join(",")})`,
    [actor.id, purpose, ...clean],
  );
  const byId = new Map(rows.map((r) => [r.id, r.url]));
  if (byId.size !== new Set(clean).size) throw new ActionError("Ảnh không hợp lệ hoặc không phải của bạn.");
  return [...new Set(clean)].map((id) => byId.get(id)!);
}

/**
 * Same check as ownUploadUrls, for forms that send back the image URLs they show
 * (e.g. an edit form keeping some old photos and adding new ones). Order is preserved.
 */
export async function verifyOwnUploadUrls(actor: Actor, purpose: UploadPurpose, urls: unknown, max: number): Promise<string[]> {
  if (urls === undefined || urls === null) return [];
  if (!Array.isArray(urls) || urls.some((u) => typeof u !== "string" || u.length > 500)) throw new ActionError("Ảnh không hợp lệ.");
  const clean = [...new Set(urls as string[])];
  if (clean.length > max) throw new ActionError(`Tối đa ${max} ảnh.`);
  if (clean.length === 0) return [];
  const rows = await all<{ url: string }>(
    `SELECT url FROM uploads WHERE owner_id = ? AND purpose = ? AND url IN (${clean.map(() => "?").join(",")})`,
    [actor.id, purpose, ...clean],
  );
  if (rows.length !== clean.length) throw new ActionError("Ảnh không hợp lệ hoặc không phải của bạn.");
  return clean;
}

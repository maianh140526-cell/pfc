import { AppError } from "@/lib/errors";

/**
 * Task attachments (pure policy). The file itself is uploaded to PFC App storage (which checks the bytes);
 * Club only accepts links that point there: PFC App's own `/api/files/…` path (dev) or an https URL (Blob).
 */
export const ATTACHMENT_MIME = ["application/pdf", "image/webp", "image/png", "image/jpeg"] as const;
export const MAX_ATTACHMENTS_PER_TASK = 10;
export const MAX_ATTACHMENT_BYTES = 8 * 1024 * 1024;

export type AttachmentInput = { name: string; url: string; mimeType: string; sizeBytes: number };

export function assertAttachment(input: AttachmentInput): AttachmentInput {
  const name = input.name.trim().replace(/[\r\n\t]/g, " ").slice(0, 120);
  const url = input.url.trim();
  if (!name) throw new AppError("VALIDATION", "Attachment name required", 422);
  const okUrl = /^\/api\/files\/[a-z]+\/[0-9a-f-]{36}\.(pdf|webp)$/.test(url) || /^https:\/\/[^\s"'<>]{8,500}$/.test(url);
  if (!okUrl) throw new AppError("VALIDATION", "Attachment link must be a PFC upload or https URL", 422);
  if (!ATTACHMENT_MIME.includes(input.mimeType as (typeof ATTACHMENT_MIME)[number])) {
    throw new AppError("VALIDATION", `MIME not allowed: ${input.mimeType}`, 422);
  }
  const size = Math.round(Number(input.sizeBytes) || 0);
  if (size < 0 || size > MAX_ATTACHMENT_BYTES) throw new AppError("VALIDATION", "File size out of bounds", 422);
  return { name, url, mimeType: input.mimeType, sizeBytes: size };
}

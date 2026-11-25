import "server-only";
import sharp from "sharp";

/**
 * Image intake. Never trusts the file name or the browser's Content-Type:
 * - sniffs JPEG / PNG / WebP magic bytes (SVG, HEIC, GIF… are refused: SVG can carry scripts),
 * - decodes with a pixel cap (no decompression bombs),
 * - auto-rotates, downsizes to ≤ 1600 px and re-encodes to WebP, which drops EXIF/GPS metadata.
 */
export const MAX_UPLOAD_BYTES = 8 * 1024 * 1024;
const MAX_INPUT_PIXELS = 40_000_000;
const MAX_EDGE = 1600;

export type Sniffed = "image/jpeg" | "image/png" | "image/webp";

export function sniffImage(b: Uint8Array): Sniffed | null {
  if (b.length >= 3 && b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff) return "image/jpeg";
  if (b.length >= 8 && b[0] === 0x89 && b[1] === 0x50 && b[2] === 0x4e && b[3] === 0x47 && b[4] === 0x0d && b[5] === 0x0a && b[6] === 0x1a && b[7] === 0x0a) return "image/png";
  if (b.length >= 12 && String.fromCharCode(...b.subarray(0, 4)) === "RIFF" && String.fromCharCode(...b.subarray(8, 12)) === "WEBP") return "image/webp";
  return null;
}

export type ProcessedImage = { data: Buffer; mime: "image/webp"; width: number; height: number };

export class ImageRejected extends Error {}

/** square: centre-crop to 512×512 (avatars). */
export async function processImage(input: Buffer, opts: { square?: boolean } = {}): Promise<ProcessedImage> {
  if (input.length === 0) throw new ImageRejected("Tệp rỗng.");
  if (input.length > MAX_UPLOAD_BYTES) throw new ImageRejected("Ảnh tối đa 8 MB.");
  if (!sniffImage(input)) throw new ImageRejected("Chỉ nhận ảnh JPG, PNG hoặc WebP.");
  try {
    const { data, info } = await sharp(input, { limitInputPixels: MAX_INPUT_PIXELS, failOn: "error" })
      .rotate()
      .resize(opts.square ? { width: 512, height: 512, fit: "cover", position: "attention" } : { width: MAX_EDGE, height: MAX_EDGE, fit: "inside", withoutEnlargement: true })
      .webp({ quality: 82 })
      .toBuffer({ resolveWithObject: true });
    return { data, mime: "image/webp", width: info.width, height: info.height };
  } catch {
    throw new ImageRejected("Ảnh bị hỏng hoặc quá lớn (tối đa 40 megapixel).");
  }
}

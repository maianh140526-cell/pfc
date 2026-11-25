import "server-only";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

/**
 * Where uploaded bytes live.
 * PFC_STORAGE=blob  → Vercel Blob (production; needs BLOB_READ_WRITE_TOKEN). Public, unguessable URLs.
 * otherwise         → local disk under .data/uploads, served by /api/files/<key> (development).
 * Only server-processed images are stored; keys are random ids generated here.
 */
export const storageMode = (): "blob" | "local" => (process.env.PFC_STORAGE === "blob" ? "blob" : "local");

const LOCAL_DIR = () => path.resolve(process.env.PFC_UPLOAD_DIR || ".data/uploads");
const KEY_RE = /^[a-z]+\/[0-9a-f-]{36}\.(webp|pdf|docx|xlsx|pptx|txt|csv)$/;

export function isValidKey(key: string): boolean {
  return KEY_RE.test(key);
}

export async function putObject(key: string, data: Buffer, contentType: string): Promise<string> {
  if (!isValidKey(key)) throw new Error("invalid storage key");
  if (storageMode() === "blob") {
    const { put } = await import("@vercel/blob");
    const res = await put(`pfc/${key}`, data, { access: "public", contentType, addRandomSuffix: false, cacheControlMaxAge: 31536000 });
    return res.url;
  }
  const file = path.join(LOCAL_DIR(), key);
  await mkdir(path.dirname(file), { recursive: true });
  await writeFile(file, data);
  return `/api/files/${key}`;
}

/** Local mode only (production serves straight from Blob). */
export async function readLocalObject(key: string): Promise<Buffer | null> {
  if (!isValidKey(key)) return null;
  try {
    return await readFile(path.join(LOCAL_DIR(), key));
  } catch {
    return null;
  }
}

import { mkdir, readFile, writeFile } from "fs/promises";
import path from "path";
import { prisma } from "@/lib/prisma";

/**
 * Private CV bytes. Never served directly: /api/cv/file checks the signed link and ownership first.
 * OPP_FILE_STORAGE=db  → stored in the database (OppFileBlob). Required on serverless hosts (Vercel)
 *                         where the disk is not persistent. Works with Turso.
 * otherwise             → local disk under data/private-cv (development).
 * Reads fall back to the other store, so switching modes keeps older files readable.
 */
const ROOT = path.join(process.cwd(), "data", "private-cv");
const useDb = () => process.env.OPP_FILE_STORAGE === "db";

function assertKey(storageKey: string): void {
  if (!/^[a-f0-9]{64}$/.test(storageKey)) throw new Error("Invalid storage key");
}

function filePath(storageKey: string): string {
  assertKey(storageKey);
  return path.join(ROOT, storageKey);
}

export async function writePrivateFile(storageKey: string, bytes: Buffer): Promise<void> {
  assertKey(storageKey);
  if (useDb()) {
    await prisma.oppFileBlob.create({ data: { storageKey, bytes: new Uint8Array(bytes) } });
    return;
  }
  await mkdir(ROOT, { recursive: true });
  await writeFile(filePath(storageKey), bytes);
}

export async function readPrivateFile(storageKey: string): Promise<Buffer> {
  assertKey(storageKey);
  const fromDb = async () => {
    const row = await prisma.oppFileBlob.findUnique({ where: { storageKey } });
    if (!row) throw new Error("File not found");
    return Buffer.from(row.bytes);
  };
  const fromDisk = () => readFile(filePath(storageKey));
  if (useDb()) return fromDb().catch(() => fromDisk());
  return fromDisk().catch(() => fromDb());
}

export function safeDownloadName(name: string): string {
  const base = name.replace(/[^\w.\- ()]/g, "_").slice(0, 80);
  return base || "cv";
}

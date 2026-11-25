import { randomUUID } from "node:crypto";
import { mkdirSync, rmSync } from "node:fs";
import path from "node:path";

/**
 * Points the platform DB at a fresh temporary file. Call at the top of a service test
 * file, before importing anything that touches the DB.
 */
export function useTempDb(): string {
  const dir = path.resolve(".data/test");
  mkdirSync(dir, { recursive: true });
  const file = path.join(dir, `${randomUUID()}.sqlite`);
  process.env.PFC_DB_URL = `file:${file}`;
  return file;
}

/** Best effort: on Windows the libSQL file may still be open; .data/ is gitignored anyway. */
export function cleanupTempDbs() {
  try {
    rmSync(path.resolve(".data/test"), { recursive: true, force: true });
  } catch {
    /* left for the next run */
  }
}

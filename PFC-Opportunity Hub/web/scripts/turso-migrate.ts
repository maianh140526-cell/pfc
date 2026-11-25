/**
 * Applies prisma/turso-migrations/<NNNN_name>/migration.sql to the Turso database (ADR-005).
 * `prisma db push` cannot talk to libsql:// URLs, so schema changes reach Turso through these files.
 *
 *   TURSO_DATABASE_URL=libsql://… TURSO_AUTH_TOKEN=… npm run db:turso:migrate
 *
 * Each file runs once, inside a transaction, and is recorded in _pfc_migrations.
 * New change: see DEPLOY.md ("Thay đổi schema").
 */
import { createClient } from "@libsql/client";
import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";

const url = process.env.TURSO_DATABASE_URL?.trim();
if (!url) {
  console.error("TURSO_DATABASE_URL chưa được đặt.");
  process.exit(1);
}
const client = createClient({ url, authToken: process.env.TURSO_AUTH_TOKEN?.trim() || undefined });
const dir = path.join(process.cwd(), "prisma", "turso-migrations");

async function main() {
  await client.execute("CREATE TABLE IF NOT EXISTS _pfc_migrations (name TEXT PRIMARY KEY, applied_at TEXT NOT NULL)");
  const done = new Set((await client.execute("SELECT name FROM _pfc_migrations")).rows.map((r) => String(r.name)));
  const pending = readdirSync(dir, { withFileTypes: true })
    .filter((d) => d.isDirectory() && /^\d{4}_[\w-]+$/.test(d.name))
    .map((d) => d.name)
    .sort()
    .filter((n) => !done.has(n));

  if (pending.length === 0) {
    console.log("Turso đã ở phiên bản schema mới nhất.");
    return;
  }
  for (const name of pending) {
    const sql = readFileSync(path.join(dir, name, "migration.sql"), "utf8");
    // Prisma's script separates statements with ";" at line end; strip comments first.
    const statements = sql
      .split(/;\s*$/m)
      .map((s) => s.replace(/^\s*--.*$/gm, "").trim())
      .filter(Boolean);
    const tx = await client.transaction("write");
    try {
      for (const s of statements) await tx.execute(s);
      await tx.execute({ sql: "INSERT INTO _pfc_migrations (name, applied_at) VALUES (?, ?)", args: [name, new Date().toISOString()] });
      await tx.commit();
      console.log(`✔ ${name} (${statements.length} câu lệnh)`);
    } catch (err) {
      await tx.rollback();
      console.error(`✘ ${name}: đã hoàn tác, không có thay đổi nào được ghi.`);
      throw err;
    } finally {
      tx.close();
    }
  }
}

main()
  .catch((err) => {
    console.error(err instanceof Error ? err.message : err);
    process.exitCode = 1;
  })
  .finally(() => client.close());

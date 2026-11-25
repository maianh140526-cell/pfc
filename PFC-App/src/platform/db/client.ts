import "server-only";
import { createClient, type Client, type InValue } from "@libsql/client";
import { mkdirSync } from "node:fs";
import path from "node:path";
import { MIGRATIONS } from "./migrations";

/**
 * Central database (SRS §11 "Centralized Database"). libSQL: a local file in dev,
 * Turso in production — same driver choice as Club ADR-007.
 */
let client: Client | null = null;
let ready: Promise<void> | null = null;

function dbUrl(): string {
  return process.env.PFC_DB_URL || "file:.data/pfc.sqlite";
}

function getClient(): Client {
  if (client) return client;
  const url = dbUrl();
  if (url.startsWith("file:")) {
    mkdirSync(path.dirname(path.resolve(url.slice("file:".length))), { recursive: true });
  }
  client = createClient({ url, authToken: process.env.PFC_DB_AUTH_TOKEN || undefined });
  return client;
}

async function migrate(c: Client): Promise<void> {
  await c.execute("PRAGMA foreign_keys = ON");
  await c.execute(
    "CREATE TABLE IF NOT EXISTS schema_migrations (version INTEGER PRIMARY KEY, applied_at TEXT NOT NULL)",
  );
  const applied = new Set(
    (await c.execute("SELECT version FROM schema_migrations")).rows.map((r) => Number(r.version)),
  );
  for (const m of MIGRATIONS) {
    if (applied.has(m.version)) continue;
    if (m.rebuild) {
      // One script on one stream (works for local files and Turso): FK enforcement must be off while the
      // old table is dropped, or ON DELETE CASCADE would wipe child rows. The rebuild copies rows unchanged;
      // PRAGMA foreign_key_check runs right after commit and stops start-up if anything is inconsistent.
      const stmts = m.statements.map((x) => x.trim().replace(/;$/, "")).join(";\n");
      try {
        await c.executeMultiple(`PRAGMA foreign_keys = OFF;
BEGIN;
${stmts};
INSERT INTO schema_migrations (version, applied_at) VALUES (${m.version}, '${new Date().toISOString()}');
COMMIT;`);
      } catch (err) {
        await c.execute("ROLLBACK").catch(() => undefined);
        await c.execute("PRAGMA foreign_keys = ON").catch(() => undefined);
        throw err;
      }
      const bad = await c.execute("PRAGMA foreign_key_check");
      await c.execute("PRAGMA foreign_keys = ON");
      if (bad.rows.length) throw new Error(`Migration ${m.version}: foreign key check failed (${bad.rows.length} rows)`);
      continue;
    }
    await c.batch(
      [
        ...m.statements.map((sql) => ({ sql, args: [] })),
        {
          sql: "INSERT INTO schema_migrations (version, applied_at) VALUES (?, ?)",
          args: [m.version, new Date().toISOString()],
        },
      ],
      "write",
    );
  }
}

/** Returns a migrated client. Safe to call from every request. */
export async function db(): Promise<Client> {
  const c = getClient();
  ready ??= migrate(c).catch((err) => {
    ready = null;
    throw err;
  });
  await ready;
  return c;
}

export type Row = Record<string, unknown>;

export async function all<T = Row>(sql: string, args: InValue[] = []): Promise<T[]> {
  const res = await (await db()).execute({ sql, args });
  return res.rows as unknown as T[];
}

export async function one<T = Row>(sql: string, args: InValue[] = []): Promise<T | null> {
  return (await all<T>(sql, args))[0] ?? null;
}

export async function run(sql: string, args: InValue[] = []): Promise<number> {
  const res = await (await db()).execute({ sql, args });
  return res.rowsAffected;
}

/**
 * Interactive write transaction: run reads/conditional writes and throw to roll back.
 * Used where a later step depends on an earlier one's rowsAffected (e.g. stock checks).
 */
export async function withTransaction<T>(fn: (t: { execute: (sql: string, args?: InValue[]) => Promise<{ rows: Row[]; rowsAffected: number }> }) => Promise<T>): Promise<T> {
  const t = await (await db()).transaction("write");
  try {
    const out = await fn({
      execute: async (sql, args = []) => {
        const r = await t.execute({ sql, args });
        return { rows: r.rows as unknown as Row[], rowsAffected: r.rowsAffected };
      },
    });
    await t.commit();
    return out;
  } catch (err) {
    await t.rollback().catch(() => undefined);
    throw err;
  } finally {
    t.close();
  }
}

export async function tx(statements: Array<{ sql: string; args?: InValue[] }>): Promise<void> {
  await (await db()).batch(
    statements.map((s) => ({ sql: s.sql, args: s.args ?? [] })),
    "write",
  );
}

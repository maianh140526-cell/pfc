import { describe, expect, it } from "vitest";
import { db, sqlite } from "./index";
import { members, tasks } from "./schema";
import { seedDemo } from "./migrate";
import {
  appliedMigrationVersions,
  listMigrationFiles,
  migrateDown,
  migrateUp,
} from "./migrator";

function indexNames(): Set<string> {
  const rows = sqlite
    .prepare(
      "SELECT name FROM sqlite_master WHERE type = 'index' AND name IS NOT NULL",
    )
    .all() as { name: string }[];
  return new Set(rows.map((r) => r.name));
}

function tableNames(): Set<string> {
  const rows = sqlite
    .prepare(
      "SELECT name FROM sqlite_master WHERE type = 'table' AND name NOT LIKE 'sqlite_%'",
    )
    .all() as { name: string }[];
  return new Set(rows.map((r) => r.name));
}

function hasColumn(table: string, column: string): boolean {
  const rows = sqlite.prepare(`PRAGMA table_info(${table})`).all() as {
    name: string;
  }[];
  return rows.some((r) => r.name === column);
}

/** Every migration in drizzle/ is applied, in order — derived from the folder so new migrations don't break the test. */
const ALL = listMigrationFiles().map((m) => m.version);

function expectFullSchema() {
  expect(indexNames().has("tasks_deadline_idx")).toBe(true);
  expect(hasColumn("audit_events", "bypass")).toBe(true);
  expect(hasColumn("memberships", "join_reason")).toBe(true);
  expect(hasColumn("tasks", "progress")).toBe(true);
  expect(tableNames().has("club_invite_tokens")).toBe(true);
  expect(tableNames().has("member_platform_ids")).toBe(true);
  expect(tableNames().has("task_comments")).toBe(true);
  expect(tableNames().has("notifications")).toBe(true);
}

describe("CM-101 versioned migrate up/down", () => {
  it("up → seed → down one step preserves rows, no FK orphans, up restores the latest", async () => {
    // The known history must still be there, in order, at the start of the list.
    expect(ALL.slice(0, 8)).toEqual([
      "0001_init_club",
      "0002_secondary_indexes",
      "0003_audit_sensitive",
      "0004_membership_p4b",
      "0005_g6_cross_cutting",
      "0006_membership_ops",
      "0007_platform_sso",
      "0008_task_pm",
    ]);

    migrateUp();
    expect(appliedMigrationVersions()).toEqual(ALL);
    expectFullSchema();

    await seedDemo();
    const seededMembers = db.select().from(members).all();
    const seededTasks = db.select().from(tasks).all();
    expect(seededMembers.length).toBeGreaterThanOrEqual(2);
    expect(seededTasks.length).toBeGreaterThanOrEqual(1);
    const memberIds = seededMembers.map((m) => m.id);

    const rolled = migrateDown();
    expect(rolled).toBe(ALL[ALL.length - 1]);
    expect(appliedMigrationVersions()).toEqual(ALL.slice(0, -1));
    expect(tableNames().has("members")).toBe(true);
    expect(db.select().from(members).all().map((m) => m.id)).toEqual(memberIds);
    expect(db.select().from(tasks).all().map((t) => t.id)).toEqual(seededTasks.map((t) => t.id));
    expect(sqlite.pragma("foreign_key_check") as unknown[]).toEqual([]);

    migrateUp();
    expect(appliedMigrationVersions()).toEqual(ALL);
    expectFullSchema();
    expect(db.select().from(members).all().map((m) => m.id)).toEqual(memberIds);
    expect(sqlite.pragma("foreign_key_check") as unknown[]).toEqual([]);
  });
});

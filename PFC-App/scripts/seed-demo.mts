/**
 * Local demo data. NEVER runs in production.
 *   npm run db:seed
 *
 * Accounts use the same emails as Club's role demo catalog
 * (PFC-Management/apps/club/src/db/role-demo-catalog.ts), so "one account" means the same
 * person in PFC, Club and Opportunity. Password for all demo accounts: see DEMO_PASSWORD
 * below (same as Club's CLUB.md demo password).
 */
import { readFileSync } from "node:fs";
import { randomUUID } from "node:crypto";

function loadEnv(file: string) {
  try {
    for (const line of readFileSync(file, "utf8").split(/\r?\n/)) {
      const m = line.match(/^([A-Z0-9_]+)=(.*)$/);
      if (m && process.env[m[1]] === undefined) process.env[m[1]] = m[2];
    }
  } catch {
    /* optional */
  }
}
loadEnv(".env.local");

if (process.env.NODE_ENV === "production") {
  console.error("Refusing to seed demo data in production.");
  process.exit(1);
}

const bcrypt = (await import("bcryptjs")).default;
const { one, run } = await import("../src/platform/db/client.ts");
const { seedHubDemo } = await import("./seed-hubs.ts");

const DEMO_PASSWORD = "PFC123!";

const ACCOUNTS = [
  { email: "leader@pfc.vn", name: "Nguyen Phuong Linh", role: "chu_nhiem", department: null },
  { email: "exec@pfc.vn", name: "Tran Ban Dieu Hanh", role: "ban_dieu_hanh", department: null },
  { email: "chuyenmon@pfc.vn", name: "Le Minh Anh", role: "truong_ban", department: "chuyen_mon" },
  { email: "truyenthong@pfc.vn", name: "Pham Thu Ha", role: "truong_ban", department: "truyen_thong" },
  { email: "sukien@pfc.vn", name: "Hoang Gia Bao", role: "truong_ban", department: "su_kien" },
  { email: "member@pfc.vn", name: "Tran Minh Duc", role: "thanh_vien", department: null },
  { email: "pending@pfc.vn", name: "Ngo Cho Duyet", role: "thanh_vien", department: null },
] as const;

const hash = await bcrypt.hash(DEMO_PASSWORD, 10);
const ids: Record<string, string> = {};
for (const a of ACCOUNTS) {
  const existing = await one<{ id: string }>("SELECT id FROM members WHERE email = ?", [a.email]);
  const now = new Date().toISOString();
  if (existing) {
    await run("UPDATE members SET role = ?, department = ?, locked = 0, updated_at = ? WHERE id = ?", [a.role, a.department, now, existing.id]);
    ids[a.email] = existing.id;
  } else {
    const id = randomUUID();
    await run(
      "INSERT INTO members (id, email, full_name, password_hash, role, department, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
      [id, a.email, a.name, hash, a.role, a.department, now, now],
    );
    ids[a.email] = id;
  }
}
console.log(`Demo accounts ready (${ACCOUNTS.length}).`);

await seedHubDemo(ids);
console.log("Done.");

#!/usr/bin/env node
/**
 * One command for local development: Club (:3000), Opportunity (:3001) and PFC App (:3200).
 *   npm run start:all          PFC App production server (builds first if there is no build)
 *   npm run start:all -- --dev PFC App in dev mode
 * Hubs are warmed up (first compile) so the PFC app does not show "Chưa kết nối được…".
 * Ctrl+C stops all three.
 */
import { spawn } from "node:child_process";
import { existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const app = join(dirname(fileURLToPath(import.meta.url)), "..");
const root = join(app, "..");
const dev = process.argv.includes("--dev");

const procs = [
  { name: "club", color: 35, cwd: join(root, "PFC-Management", "apps", "club"), cmd: "npm run dev:club", warm: "http://127.0.0.1:3000/api/club?action=me" },
  { name: "opp", color: 36, cwd: join(root, "PFC-Opportunity Hub", "web"), cmd: "npm run dev", warm: "http://127.0.0.1:3001/api/auth/me" },
  {
    name: "pfc",
    color: 33,
    cwd: app,
    cmd: dev ? "npm run dev" : existsSync(join(app, ".next", "BUILD_ID")) ? "npm start" : "npm run build && npm start",
  },
];

const children = [];
for (const p of procs) {
  if (!existsSync(p.cwd)) {
    console.error(`[${p.name}] không tìm thấy thư mục ${p.cwd}`);
    continue;
  }
  if (!existsSync(join(p.cwd, "node_modules"))) console.warn(`[${p.name}] chưa cài thư viện: chạy "npm install" trong ${p.cwd}`);
  const child = spawn(p.cmd, { cwd: p.cwd, shell: true, env: process.env });
  const tag = `\x1b[${p.color}m[${p.name}]\x1b[0m `;
  const pipe = (stream, out) => stream.on("data", (d) => out.write(String(d).replace(/^(?=.)/gm, tag)));
  pipe(child.stdout, process.stdout);
  pipe(child.stderr, process.stderr);
  child.on("exit", (code) => console.log(`${tag}đã dừng (mã ${code})`));
  children.push(child);
}

/** Poll each hub until it answers (any HTTP status), which also triggers its first compile. */
async function warm(p) {
  for (let i = 0; i < 90; i++) {
    try {
      await fetch(p.warm, { signal: AbortSignal.timeout(60_000) });
      console.log(`\x1b[${p.color}m[${p.name}]\x1b[0m sẵn sàng`);
      return;
    } catch {
      await new Promise((r) => setTimeout(r, 2000));
    }
  }
  console.warn(`[${p.name}] chưa phản hồi sau 3 phút: xem log ở trên.`);
}
Promise.all(procs.filter((p) => p.warm).map(warm)).then(() => console.log("\nMở http://localhost:3200 — Câu lạc bộ và Cơ hội đã sẵn sàng.\n"));

const stop = () => {
  for (const c of children) {
    if (c.exitCode !== null) continue;
    // shell:true spawns a shell; on Windows kill the whole tree.
    if (process.platform === "win32") spawn("taskkill", ["/pid", String(c.pid), "/T", "/F"], { stdio: "ignore" });
    else c.kill("SIGTERM");
  }
  setTimeout(() => process.exit(0), 500);
};
process.on("SIGINT", stop);
process.on("SIGTERM", stop);

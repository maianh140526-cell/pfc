import { beforeEach, describe, expect, it } from "vitest";
import bcrypt from "bcryptjs";
import { nanoid } from "nanoid";
import { db } from "@/db";
import { members, memberships } from "@/db/schema";
import { migrateUp } from "@/db/migrate";
import { migrateDown } from "@/db/migrate-meta";
import type { SessionUser } from "@/lib/auth";
import * as clubs from "@/server/clubs";
import * as tasks from "@/server/tasks";

function user(email: string): SessionUser {
  const id = nanoid();
  db.insert(members).values({ id, email, fullName: email, passwordHash: bcrypt.hashSync("PFC123!", 4), isSuperAdmin: false }).run();
  return { id, email, fullName: email, isSuperAdmin: false };
}
function join(clubId: string, u: SessionUser, position = "member") {
  db.insert(memberships).values({ id: nanoid(), clubId, memberId: u.id, position, status: "active" }).run();
}

const PDF = { name: "Bao cao.pdf", url: "/api/files/document/0b6f8a52-8a9b-4f7b-9c2e-2b8c1f0a9d11.pdf", mimeType: "application/pdf", sizeBytes: 1200 };

describe("task attachments, progress, review proof", () => {
  beforeEach(() => {
    migrateDown();
    migrateUp();
  });

  it("assignee attaches files and updates progress; others cannot; first file unlocks review", () => {
    const owner = user("owner@pfc.vn");
    const club = clubs.createClub(owner, { name: "PFC", visibility: "private" });
    const a = user("a@pfc.vn");
    const b = user("b@pfc.vn");
    join(club.id, a);
    join(club.id, b);
    const taskId = tasks.createTask(owner, club.id, { title: "Thiết kế poster", assigneeId: a.id, deadline: new Date(Date.now() + 7 * 86400_000) });

    expect(() => tasks.addTaskAttachment(b, taskId, PDF)).toThrow(); // not assignee, not a manager
    expect(() => tasks.addTaskAttachment(a, taskId, { ...PDF, url: "javascript:alert(1)" })).toThrow(/link/);
    expect(() => tasks.addTaskAttachment(a, taskId, { ...PDF, mimeType: "application/x-msdownload" })).toThrow(/MIME/);

    tasks.setTaskProgress(a, taskId, 40);
    expect(() => tasks.setTaskProgress(b, taskId, 90)).toThrow();

    tasks.transitionTask(a, taskId, "todo");
    tasks.transitionTask(a, taskId, "in_progress");
    expect(() => tasks.transitionTask(a, taskId, "review")).toThrow(/Proof/i);
    const att = tasks.addTaskAttachment(a, taskId, PDF);
    tasks.transitionTask(a, taskId, "review");

    const d = tasks.getTaskDetail(owner, taskId);
    expect(d.attachments).toHaveLength(1);
    expect(d.attachments[0]).toMatchObject({ name: "Bao cao.pdf", uploaderId: a.id });
    expect(d.task.progress).toBe(40);

    expect(() => tasks.removeTaskAttachment(b, att)).toThrow();
    tasks.removeTaskAttachment(owner, att);
    expect(tasks.getTaskDetail(owner, taskId).attachments).toHaveLength(0);
  });
});

import { describe, expect, it } from "vitest";
import {
  allowedTaskStatus,
  applyProjectAction,
  availableProjectActions,
  canEditProject,
  canEditTask,
  canInviteAs,
  canRemoveMember,
  parseSkills,
  projectCaps,
  projectProgress,
  safeHttpsUrl,
} from "./projects";

const owner = { isOwner: true, canApprove: false, canArchiveAny: false };
const approver = { isOwner: false, canApprove: true, canArchiveAny: false };
const stranger = { isOwner: false, canApprove: false, canArchiveAny: false };
const none = { manageAny: false };
const boss = { manageAny: true };

describe("project lifecycle", () => {
  it("draft → submitted → active → completed → archived, restore by approver", () => {
    expect(applyProjectAction("submit", "draft", owner)).toEqual({ ok: true, to: "submitted" });
    expect(applyProjectAction("approve", "submitted", approver)).toEqual({ ok: true, to: "active" });
    expect(applyProjectAction("complete", "active", owner)).toEqual({ ok: true, to: "completed" });
    expect(applyProjectAction("reopen", "completed", owner)).toEqual({ ok: true, to: "active" });
    expect(applyProjectAction("archive", "completed", owner)).toEqual({ ok: true, to: "archived" });
    expect(applyProjectAction("restore", "archived", owner).ok).toBe(false);
    expect(applyProjectAction("restore", "archived", approver)).toEqual({ ok: true, to: "active" });
  });
  it("an owner who can approve publishes directly", () => {
    expect(applyProjectAction("submit", "draft", { ...owner, canApprove: true })).toEqual({ ok: true, to: "active" });
  });
  it("rejection needs a reason and approval rights", () => {
    expect(applyProjectAction("reject", "submitted", approver).ok).toBe(false);
    expect(applyProjectAction("reject", "submitted", stranger, "x").ok).toBe(false);
    expect(applyProjectAction("reject", "submitted", approver, "Thiếu mô tả")).toEqual({ ok: true, to: "rejected" });
    expect(applyProjectAction("submit", "rejected", owner)).toEqual({ ok: true, to: "submitted" });
  });
  it("strangers cannot change anything; archive_any staff can archive", () => {
    expect(availableProjectActions("active", stranger)).toEqual([]);
    expect(availableProjectActions("active", { ...stranger, canArchiveAny: true })).toEqual(["archive"]);
    expect(availableProjectActions("draft", owner)).toEqual(["submit"]);
  });
  it("editing rules", () => {
    expect(canEditProject("active", owner)).toBe(true);
    expect(canEditProject("submitted", owner)).toBe(false);
    expect(canEditProject("archived", approver)).toBe(false);
    expect(canEditProject("draft", stranger)).toBe(false);
  });
});

describe("membership permissions", () => {
  it("only the owner (or Chủ nhiệm) removes members; never the owner", () => {
    expect(canRemoveMember("owner", "member", none)).toBe(true);
    expect(canRemoveMember("lead", "member", none)).toBe(false);
    expect(canRemoveMember("member", "member", none)).toBe(false);
    expect(canRemoveMember("mentor", "member", none)).toBe(false);
    expect(canRemoveMember(null, "lead", boss)).toBe(true);
    expect(canRemoveMember(null, "owner", boss)).toBe(false);
    expect(canRemoveMember("owner", "owner", none)).toBe(false);
  });
  it("leads admit members but cannot kick or change roles", () => {
    const c = projectCaps("lead", none);
    expect(c.admitMembers).toBe(true);
    expect(c.removeMembers).toBe(false);
    expect(c.changeRoles).toBe(false);
    expect(canInviteAs("lead", "member", none)).toBe(true);
    expect(canInviteAs("lead", "mentor", none)).toBe(false);
    expect(canInviteAs("owner", "mentor", none)).toBe(true);
    expect(canInviteAs("owner", "owner", none)).toBe(false);
  });
  it("plain members and mentors cannot admit anyone; outsiders give feedback only", () => {
    expect(projectCaps("member", none).admitMembers).toBe(false);
    expect(projectCaps("mentor", none).createTasks).toBe(false);
    const outsider = projectCaps(null, none);
    expect(outsider.viewWorkspace).toBe(false);
    expect(outsider.giveFeedback).toBe(true);
    expect(projectCaps("member", none).giveFeedback).toBe(false);
  });
});

describe("tasks", () => {
  const t = { assigneeId: "a", createdBy: "c" };
  it("members edit their own tasks only and cannot close them", () => {
    expect(canEditTask("member", t, "a", none)).toBe(true);
    expect(canEditTask("member", t, "c", none)).toBe(true);
    expect(canEditTask("member", t, "x", none)).toBe(false);
    expect(canEditTask("mentor", t, "a", none)).toBe(false);
    expect(canEditTask("lead", t, "x", none)).toBe(true);
    expect(allowedTaskStatus("member", "review", none)).toBe(true);
    expect(allowedTaskStatus("member", "done", none)).toBe(false);
    expect(allowedTaskStatus("lead", "done", none)).toBe(true);
  });
  it("progress ignores cancelled tasks", () => {
    expect(projectProgress([{ status: "done" }, { status: "todo" }, { status: "cancelled" }])).toEqual({ done: 1, total: 2, percent: 50 });
    expect(projectProgress([])).toEqual({ done: 0, total: 0, percent: 0 });
  });
});

describe("helpers", () => {
  it("accepts https links only", () => {
    expect(safeHttpsUrl("https://github.com/pfc/app")).toBe("https://github.com/pfc/app");
    expect(safeHttpsUrl("http://example.com")).toBeNull();
    expect(safeHttpsUrl("javascript:alert(1)")).toBeNull();
    expect(safeHttpsUrl("https://localhost")).toBeNull();
    expect(safeHttpsUrl("not a url")).toBeNull();
  });
  it("normalises skills", () => {
    expect(parseSkills(" React, react ,Excel,, Phân tích ")).toEqual(["React", "Excel", "Phân tích"]);
  });
});

import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { cleanupTempDbs, useTempDb } from "../../../../test/db";

useTempDb();
const { makeMember } = await import("../../../../test/members");
const prj = await import("./service");

type M = Awaited<ReturnType<typeof makeMember>>;
let boss: M, headCM: M, headTT: M, owner: M, lead: M, dev: M, mentor: M, outsider: M;
let pid: string;

const PROJECT = { title: "Ứng dụng quản lý chi tiêu sinh viên", summary: "Giúp sinh viên lập ngân sách tháng đơn giản.", category: "fintech", skills: "React, Excel", recruiting: true };

beforeAll(async () => {
  boss = await makeMember("chu_nhiem", null, "Chủ nhiệm");
  headCM = await makeMember("truong_ban", "chuyen_mon", "TB Chuyên môn");
  headTT = await makeMember("truong_ban", "truyen_thong", "TB Truyền thông");
  owner = await makeMember("thanh_vien", null, "Chủ dự án");
  lead = await makeMember("thanh_vien", null, "Trưởng nhóm");
  dev = await makeMember("thanh_vien", null, "Dev");
  mentor = await makeMember("thanh_vien", null, "Mentor");
  outsider = await makeMember("thanh_vien", null, "Người ngoài");
});
afterAll(cleanupTempDbs);

describe("lifecycle & visibility", () => {
  it("drafts are private until approved by Trưởng ban Chuyên môn (not Truyền thông)", async () => {
    pid = await prj.createProject(owner, PROJECT);
    expect(await prj.getProject(outsider, pid)).toBeNull();
    expect((await prj.listProjects()).map((p) => p.id)).not.toContain(pid);
    expect(await prj.projectTransition(owner, pid, "submit")).toBe("submitted");
    await expect(prj.updateProject(owner, pid, PROJECT)).rejects.toThrow(/chờ duyệt/);
    await expect(prj.approvalQueue(headTT)).rejects.toThrow(/quyền/);
    await expect(prj.projectTransition(headTT, pid, "approve")).rejects.toThrow(/quyền/);
    expect((await prj.approvalQueue(headCM)).map((p) => p.id)).toContain(pid);
    await expect(prj.projectTransition(headCM, pid, "reject")).rejects.toThrow(/lý do/);
    expect(await prj.projectTransition(headCM, pid, "approve")).toBe("active");
    const card = (await prj.listProjects({ q: "chi tiêu" })).find((p) => p.id === pid);
    expect(card?.memberCount).toBe(1);
    expect(card?.skills).toEqual(["React", "Excel"]);
  });
  it("published projects cannot be deleted, only archived", async () => {
    await expect(prj.deleteProject(owner, pid)).rejects.toThrow(/lưu trữ/);
    await expect(prj.deleteProject(outsider, pid)).rejects.toThrow(/chủ dự án/);
  });
});

describe("membership & roles", () => {
  it("join requests are accepted by the owner; invitations by email", async () => {
    await expect(prj.requestToJoin(dev, pid, { role: "member", message: "ngắn" })).rejects.toThrow();
    await prj.requestToJoin(dev, pid, { role: "member", message: "Mình biết React và muốn tham gia." });
    await expect(prj.requestToJoin(dev, pid, { role: "member", message: "Mình biết React và muốn tham gia." })).rejects.toThrow(/đã gửi/);
    const detail = await prj.getProject(owner, pid);
    expect(detail?.pending.map((m) => m.memberId)).toContain(dev.id);
    // A plain member cannot see or decide requests.
    expect((await prj.getProject(outsider, pid))?.pending).toEqual([]);
    await expect(prj.decideRequest(outsider, pid, dev.id, true)).rejects.toThrow(/quyền/);
    await prj.decideRequest(owner, pid, dev.id, true);

    await prj.inviteMember(owner, pid, { email: lead.email, role: "lead" });
    const { listNotifications } = await import("@/platform/notifications/service");
    expect((await listNotifications(lead.id))[0]?.title).toMatch(/được mời tham gia dự án/);
    expect((await listNotifications(owner.id)).some((n) => /yêu cầu tham gia/.test(n.title))).toBe(true);
    expect((await prj.myProjects(lead)).map((p) => [p.id, p.myRole, p.myStatus])).toEqual([[pid, "lead", "invited"]]);
    expect((await prj.projectHomeStats(lead)).invites).toBe(1);
    await prj.respondInvite(lead, pid, true);
    expect((await prj.myProjects(lead))[0].myStatus).toBe("active");
    expect((await prj.myProjects(owner))[0].myRole).toBe("owner");
    await expect(prj.inviteMember(owner, pid, { email: "khong-ton-tai@pfc.vn", role: "member" })).rejects.toThrow(/Không có tài khoản/);
  });
  it("a lead admits members but cannot invite mentors, kick anyone or change roles", async () => {
    await expect(prj.inviteMember(lead, pid, { email: mentor.email, role: "mentor" })).rejects.toThrow(/chỉ mời được thành viên/);
    await prj.requestToJoin(mentor, pid, { role: "mentor", message: "Mình có 5 năm làm phân tích tài chính." });
    await expect(prj.decideRequest(lead, pid, mentor.id, true)).rejects.toThrow(/mentor/);
    await prj.decideRequest(owner, pid, mentor.id, true);
    await expect(prj.removeMember(lead, pid, dev.id)).rejects.toThrow(/Chỉ chủ dự án/);
    await expect(prj.setMemberRole(lead, pid, dev.id, "lead")).rejects.toThrow(/Chỉ chủ dự án/);
  });
  it("members never remove anyone; nobody removes the owner", async () => {
    await expect(prj.removeMember(dev, pid, lead.id)).rejects.toThrow(/Chỉ chủ dự án/);
    await expect(prj.removeMember(mentor, pid, dev.id)).rejects.toThrow(/Chỉ chủ dự án/);
    await expect(prj.removeMember(boss, pid, owner.id)).rejects.toThrow(/chủ dự án/);
    await expect(prj.leaveProject(owner, pid)).rejects.toThrow(/không thể rời/);
    const d = await prj.getProject(dev, pid);
    expect(d?.myRole).toBe("member");
    expect(d?.caps.removeMembers).toBe(false);
  });
});

describe("workspace", () => {
  let devTask: string, leadTask: string;
  it("is visible to the team only", async () => {
    await expect(prj.listTasks(outsider, pid)).rejects.toThrow(/thành viên dự án/);
    await expect(prj.listUpdates(outsider, pid)).rejects.toThrow(/thành viên dự án/);
  });
  it("members self-assign, cannot assign others or close tasks", async () => {
    await expect(prj.createTask(dev, pid, { title: "Thiết kế màn hình", assigneeId: lead.id })).rejects.toThrow(/tự nhận/);
    devTask = await prj.createTask(dev, pid, { title: "Thiết kế màn hình", assigneeId: dev.id, dueDate: "2026-12-01" });
    leadTask = await prj.createTask(lead, pid, { title: "Viết kế hoạch", assigneeId: lead.id });
    await expect(prj.createTask(mentor, pid, { title: "Mentor tạo việc" })).rejects.toThrow(/quyền/);
    await expect(prj.updateTask(dev, leadTask, { title: "Viết kế hoạch", status: "in_progress", assigneeId: lead.id })).rejects.toThrow(/của mình/);
    await expect(prj.updateTask(dev, devTask, { title: "Thiết kế màn hình", status: "done", assigneeId: dev.id })).rejects.toThrow(/Chờ duyệt/);
    await prj.updateTask(dev, devTask, { title: "Thiết kế màn hình", status: "review", assigneeId: dev.id, dueDate: "2026-12-01" });
    await prj.updateTask(lead, devTask, { title: "Thiết kế màn hình", status: "done", assigneeId: dev.id, dueDate: "2026-12-01" });
    await expect(prj.createTask(lead, pid, { title: "Giao cho mentor", assigneeId: mentor.id })).rejects.toThrow(/thành viên đang hoạt động/);
    const { tasks } = await prj.listTasks(dev, pid);
    expect(tasks.find((t) => t.id === leadTask)?.canEdit).toBe(false);
    expect((await prj.getProject(dev, pid))?.progress).toEqual({ done: 1, total: 2, percent: 50 });
  });
  it("updates, milestones and links follow roles", async () => {
    await prj.postUpdate(dev, pid, { body: "Đã xong wireframe." });
    await expect(prj.postUpdate(dev, pid, { body: "Cột mốc", kind: "milestone" })).rejects.toThrow(/cột mốc/);
    await prj.postUpdate(owner, pid, { body: "Hoàn thành MVP", kind: "milestone" });
    const ups = await prj.listUpdates(dev, pid);
    expect(ups).toHaveLength(2);
    expect(ups.find((u) => u.kind === "milestone")?.canDelete).toBe(false);
    await expect(prj.addLink(dev, pid, { kind: "doc", title: "Tài liệu", url: "https://docs.example.com/a" })).rejects.toThrow(/Trưởng nhóm/);
    await expect(prj.addLink(lead, pid, { kind: "demo", title: "Demo", url: "javascript:alert(1)" })).rejects.toThrow(/https/);
    await prj.addLink(lead, pid, { kind: "demo", title: "Bản demo", url: "https://demo.example.com", visibility: "public" });
    await prj.addLink(lead, pid, { kind: "doc", title: "Kế hoạch nội bộ", url: "https://docs.example.com/plan", visibility: "team" });
    expect((await prj.getProject(outsider, pid))?.links.map((l) => l.title)).toEqual(["Bản demo"]);
    expect((await prj.getProject(dev, pid))?.links).toHaveLength(2);
  });
  it("removing a member unassigns their open tasks (owner only)", async () => {
    const t = await prj.createTask(dev, pid, { title: "Việc dang dở", assigneeId: dev.id });
    await prj.removeMember(owner, pid, dev.id);
    expect((await prj.listTasks(owner, pid)).tasks.find((x) => x.id === t)?.assigneeId).toBeNull();
    await expect(prj.listTasks(dev, pid)).rejects.toThrow(/thành viên dự án/);
    await expect(prj.requestToJoin(dev, pid, { role: "member", message: "Cho mình vào lại nhé, cảm ơn." })).rejects.toThrow(/bị loại/);
  });
});

describe("feedback, analytics, staff override", () => {
  it("outsiders rate once; team members cannot self-rate; owners cannot hide feedback", async () => {
    await expect(prj.giveFeedback(lead, pid, { rating: 5 })).rejects.toThrow(/không tự đánh giá/);
    await prj.giveFeedback(outsider, pid, { rating: 2, comment: "Cần rõ mục tiêu hơn." });
    await prj.giveFeedback(outsider, pid, { rating: 4, comment: "Đã rõ hơn." });
    const d = await prj.getProject(owner, pid);
    expect(d?.ratingCount).toBe(1);
    expect(d?.rating).toBe(4);
    await expect(prj.setFeedbackHidden(owner, d!.feedback[0].id, true)).rejects.toThrow(/quyền/);
    await prj.setFeedbackHidden(headCM, d!.feedback[0].id, true);
    expect((await prj.getProject(lead, pid))?.feedback).toEqual([]);
  });
  it("analytics for owner/lead only, counting outsider views", async () => {
    await expect(prj.projectAnalytics(outsider, pid)).rejects.toThrow();
    const a = await prj.projectAnalytics(lead, pid);
    expect(a.uniqueViewers).toBeGreaterThanOrEqual(1);
    expect(a.team).toBe(2);
    expect(a.mentors).toBe(1);
    expect(a.tasksByStatus.done).toBe(1);
  });
  it("Chủ nhiệm can step into any project", async () => {
    const d = await prj.getProject(boss, pid);
    expect(d?.caps.removeMembers).toBe(true);
    await prj.removeMember(boss, pid, mentor.id);
    expect(await prj.projectTransition(boss, pid, "archive")).toBe("archived");
    expect(await prj.getProject(outsider, pid)).toBeNull();
    await expect(prj.projectTransition(owner, pid, "restore")).rejects.toThrow(/người duyệt/);
  });
});

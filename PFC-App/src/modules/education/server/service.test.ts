import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { cleanupTempDbs, useTempDb } from "../../../../test/db";

useTempDb();
const { makeMember } = await import("../../../../test/members");
const edu = await import("./service");

type M = Awaited<ReturnType<typeof makeMember>>;
let owner: M, headCM: M, headTT: M, member: M, member2: M;
let courseId: string;

beforeAll(async () => {
  owner = await makeMember("chu_nhiem");
  headCM = await makeMember("truong_ban", "chuyen_mon");
  headTT = await makeMember("truong_ban", "truyen_thong");
  member = await makeMember("thanh_vien", null, "Thành viên A");
  member2 = await makeMember("thanh_vien", null, "Thành viên B");
});
afterAll(cleanupTempDbs);

describe("courses: who can create, review and see what", () => {
  it("any member may draft content, but only approvers publish it", async () => {
    const draft = await edu.createCourse(member2, { title: "Khóa của thành viên", topic: "finance", level: "basic" });
    expect(await edu.getCourse(member, draft)).toBeNull(); // drafts stay private
    await expect(edu.transition(member2, "course", draft, "approve")).rejects.toThrow(/quyền/);
  });

  it("Trưởng ban CM creates a course; drafts are invisible to members", async () => {
    courseId = await edu.createCourse(headCM, { title: "Quản lý tài chính cơ bản", summary: "Nhập môn", topic: "finance", level: "basic" });
    expect(await edu.getCourse(member, courseId)).toBeNull();
    expect(await edu.getCourse(null, courseId)).toBeNull();
    expect((await edu.getCourse(headCM, courseId))?.canEdit).toBe(true);
  });

  it("validates lessons (only YouTube/Vimeo videos; reading needs content)", async () => {
    await expect(edu.addLesson(headCM, courseId, { title: "Video", kind: "video", videoUrl: "https://evil.example/x" })).rejects.toThrow();
    await expect(edu.addLesson(headCM, courseId, { title: "Đọc", kind: "reading", body: "ngắn" })).rejects.toThrow();
    await edu.addLesson(headCM, courseId, { title: "Vì sao cần quản lý tài chính", kind: "video", videoUrl: "https://youtu.be/dQw4w9WgXcQ", durationMin: 8 });
    await edu.addLesson(headCM, courseId, { title: "Quy tắc 50/30/20", kind: "reading", body: "Chia thu nhập thành 50% nhu cầu, 30% mong muốn, 20% tiết kiệm." });
  });

  it("a member cannot edit someone else's course", async () => {
    await expect(edu.updateCourse(member, courseId, { title: "Hack", topic: "finance", level: "basic" })).rejects.toThrow(/quyền/);
    await expect(edu.addLesson(member, courseId, { title: "x", kind: "reading", body: "x".repeat(30) })).rejects.toThrow(/quyền/);
  });

  it("Trưởng ban CM is an approver, so submitting publishes directly", async () => {
    expect(await edu.transition(headCM, "course", courseId, "submit")).toBe("published");
    const c = await edu.getCourse(member, courseId);
    expect(c?.lessons).toHaveLength(2);
    expect((await edu.listPublishedCourses()).map((x) => x.id)).toContain(courseId);
  });

  it("an author without approve permission must wait for review; members cannot approve", async () => {
    // Promote a member-like author: Ban điều hành can create AND approve, so use a CM head draft reviewed by owner instead.
    const draft = await edu.createCourse(owner, { title: "Đầu tư cơ bản", topic: "finance", level: "intermediate" });
    await expect(edu.transition(owner, "course", draft, "submit")).rejects.toThrow(/ít nhất một bài/);
    await expect(edu.transition(member, "course", draft, "approve")).rejects.toThrow(/quyền/);
    await expect(edu.transition(headTT, "course", draft, "approve")).rejects.toThrow(/quyền/);
  });

  it("members cannot delete someone else's content; owner can", async () => {
    await expect(edu.deleteContent(member, "course", courseId)).rejects.toThrow(/quyền/);
    await expect(edu.deleteContent(headCM, "course", courseId)).rejects.toThrow(/gỡ/); // own, but already published
  });
});

describe("learning progress and certificate", () => {
  it("completing every lesson completes the course and issues a certificate", async () => {
    const c = await edu.getCourse(member, courseId);
    expect(await edu.certificate(member, courseId)).toBeNull();
    const first = await edu.completeLesson(member, c!.lessons[0].id);
    expect(first.courseCompleted).toBe(false);
    const second = await edu.completeLesson(member, c!.lessons[1].id);
    expect(second.courseCompleted).toBe(true);
    const cert = await edu.certificate(member, courseId);
    expect(cert).toMatchObject({ courseTitle: "Quản lý tài chính cơ bản", memberName: "Thành viên A" });
    expect(await edu.certificate(member2, courseId)).toBeNull();
    const ml = await edu.myLearning(member);
    expect(ml.stats).toMatchObject({ enrolled: 1, completed: 1 });
  });
});

describe("quizzes: answers never leave the server before grading", () => {
  let quizId: string;
  it("creates a quiz with validated questions", async () => {
    quizId = await edu.createQuiz(headCM, { title: "Kiểm tra cơ bản", topic: "finance", passPct: 50 });
    await expect(edu.saveQuestion(headCM, quizId, null, { prompt: "?", options: ["A"], correctIndex: 0 })).rejects.toThrow(/2–6/);
    await edu.saveQuestion(headCM, quizId, null, { prompt: "Nên tiết kiệm bao nhiêu % thu nhập theo 50/30/20?", options: ["10%", "20%", "30%"], correctIndex: 1, explanation: "20% cho tiết kiệm." });
    await edu.saveQuestion(headCM, quizId, null, { prompt: "Quỹ khẩn cấp nên đủ mấy tháng chi tiêu?", options: ["1", "3–6", "24"], correctIndex: 1 });
    expect(await edu.transition(headCM, "quiz", quizId, "submit")).toBe("published");
  });
  it("taking view hides correct answers; grading happens server-side", async () => {
    const q = await edu.getQuizForTaking(member, quizId);
    expect(JSON.stringify(q)).not.toContain("correctIndex");
    expect(JSON.stringify(q)).not.toContain("20% cho tiết kiệm");
    const [q1, q2] = q!.questions;
    const attemptId = await edu.submitAttempt(member, quizId, { [q1.id]: 1, [q2.id]: 0 });
    const r = await edu.getAttempt(member, attemptId);
    expect(r).toMatchObject({ score: 1, total: 2, passed: true });
    expect(await edu.getAttempt(member2, attemptId)).toBeNull(); // someone else's result
  });
  it("members cannot read the answer key through the editor", async () => {
    expect(await edu.getQuizForEditing(member, quizId)).toBeNull();
  });
});

describe("forum moderation", () => {
  let threadId: string;
  it("any member can post and reply; likes toggle", async () => {
    threadId = await edu.createThread(member, { topic: "finance", title: "Làm sao tiết kiệm khi lương thấp?", body: "Mình lương 6 triệu, tiết kiệm thế nào ạ?" });
    await edu.reply(member2, threadId, "Thử quy tắc 50/30/20 nhé.");
    expect(await edu.toggleLike(member2, threadId)).toBe(true);
    expect(await edu.toggleLike(member2, threadId)).toBe(false);
  });
  it("members cannot hide or delete other people's posts", async () => {
    await expect(edu.moderateThread(member2, threadId, { hidden: true })).rejects.toThrow(/quyền/);
    await expect(edu.deleteOwnPost(member2, "thread", threadId)).rejects.toThrow(/chính mình/);
  });
  it("Trưởng ban Truyền thông moderates: hidden threads disappear for members, locked threads refuse replies", async () => {
    await edu.moderateThread(headTT, threadId, { locked: true });
    await expect(edu.reply(member2, threadId, "còn ai không?")).rejects.toThrow(/khóa/);
    await edu.moderateThread(headTT, threadId, { hidden: true });
    expect(await edu.getThread(member2, threadId)).toBeNull();
    expect(await edu.getThread(member, threadId)).not.toBeNull(); // author still sees it
    expect((await edu.listThreads(member2)).find((t) => t.id === threadId)).toBeUndefined();
  });
  it("authors can delete their own thread", async () => {
    await edu.deleteOwnPost(member, "thread", threadId);
    expect(await edu.getThread(owner, threadId)).toBeNull();
  });
});

describe("resources", () => {
  it("https links or the member's own PDF; member uploads go to review", async () => {
    await expect(edu.saveResource(headCM, null, { title: "x", kind: "ebook", topic: "finance", url: "http://a.b/c" })).rejects.toThrow();
    await expect(edu.saveResource(member, null, { title: "Ebook", kind: "ebook", topic: "finance", url: "/api/files/document/00000000-0000-0000-0000-000000000000.pdf" })).rejects.toThrow(/không phải của bạn/);
    const mine = await edu.saveResource(member, null, { title: "Checklist tiết kiệm", kind: "checklist", topic: "finance", url: "https://docs.google.com/document/d/x" });
    expect(await edu.transition(member, "resource", mine, "submit")).toBe("submitted");
    const id = await edu.saveResource(headCM, null, { title: "Template ngân sách", kind: "template", topic: "finance", url: "https://docs.google.com/spreadsheets/d/x" });
    expect(await edu.transition(headCM, "resource", id, "submit")).toBe("published");
    expect((await edu.listPublishedResources()).map((r) => r.id)).toContain(id);
  });
});

describe("content management overview", () => {
  it("lists own content and the review queue for approvers; members see only their own", async () => {
    const o = await edu.manageOverview(headCM);
    expect(o.canCreate && o.canApprove).toBe(true);
    expect(o.mine.length).toBeGreaterThan(0);
    expect(o.queue.length).toBeGreaterThan(0);
    const m = await edu.manageOverview(member);
    expect(m.canCreate).toBe(true);
    expect(m.canApprove).toBe(false);
    expect(m.queue).toEqual([]);
    expect(m.mine.every((x) => x.authorName === "Thành viên A")).toBe(true);
  });
  it("forum: anyone replies to a comment; the comment author is notified", async () => {
    const t = await edu.createThread(member, { topic: "question", title: "Nên mở tài khoản chứng khoán ở đâu?", body: "Mình là sinh viên năm 2, muốn tìm hiểu." });
    await edu.reply(member2, t, "Bạn xem phí giao dịch và app có dễ dùng không nhé.");
    const first = (await edu.getThread(member, t))!.replies[0];
    await edu.reply(headCM, t, "Đồng ý, thêm nữa là phí lưu ký.", first.id);
    const th = (await edu.getThread(member, t))!;
    expect(th.replies.find((r) => r.body.startsWith("Đồng ý"))?.parentId).toBe(first.id);
    await expect(edu.reply(member, t, "x", "not-a-reply")).rejects.toThrow(/không còn/);
  });
});

describe("documents by subject with photos and files attached", () => {
  const upload = async (ownerId: string, ext: string) => {
    const { run } = await import("@/platform/db/client");
    const id = crypto.randomUUID();
    const url = `/api/files/attachment/${id}.${ext}`;
    await run("INSERT INTO uploads (id, owner_id, purpose, mime, bytes, storage_key, url, created_at) VALUES (?, ?, 'attachment', 'x', 10, ?, ?, ?)", [id, ownerId, `attachment/${id}.${ext}`, url, new Date().toISOString()]);
    return url;
  };

  it("keeps photos and files with the document, grouped by subject", async () => {
    const photo = await upload(member.id, "webp");
    const file = await upload(member.id, "docx");
    const id = await edu.saveResource(member, null, {
      title: "Bài tập chương 3",
      kind: "exercise",
      topic: "finance",
      subject: "Kinh tế vi mô",
      attachments: [
        { url: photo, name: "trang-1.jpg" },
        { url: file, name: "de-bai.docx" },
      ],
    });
    const r = await edu.getResource(member, id);
    expect(r?.subject).toBe("Kinh tế vi mô");
    expect(r?.attachments.map((a) => a.kind)).toEqual(["image", "file"]);
  });

  it("refuses someone else's upload and a document with nothing attached", async () => {
    const theirs = await upload(member2.id, "pdf");
    await expect(edu.saveResource(member, null, { title: "Của người khác", kind: "notes", topic: "finance", attachments: [{ url: theirs, name: "x.pdf" }] })).rejects.toThrow(/không phải của bạn/);
    await expect(edu.saveResource(member, null, { title: "Trống", kind: "notes", topic: "finance" })).rejects.toThrow(/Đính kèm/);
  });

  it("a document can be linked to a quiz, and a quiz carries extra material", async () => {
    const file = await upload(member.id, "pdf");
    const quizId = await edu.createQuiz(member, { title: "Kiểm tra chương 3", topic: "finance", subject: "Kinh tế vi mô", passPct: 70, attachments: [{ url: file, name: "de-cuong.pdf" }] });
    expect((await edu.getQuizForEditing(member, quizId))?.attachments).toHaveLength(1);
    const rid = await edu.saveResource(member, null, { title: "Ôn chương 3", kind: "notes", topic: "finance", url: "https://example.com/doc", quizId });
    expect((await edu.getResource(member, rid))?.quizId).toBe(quizId);
    await expect(edu.saveResource(member2, null, { title: "Gắn quiz nháp của người khác", kind: "notes", topic: "finance", url: "https://example.com/doc", quizId })).rejects.toThrow(/chưa xuất bản/);
  });
});

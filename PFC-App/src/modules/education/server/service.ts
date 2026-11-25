import "server-only";
import { isOwnAttachment, isOwnDocument } from "@/platform/uploads/service";
import { allowAttempt } from "@/platform/rate-limit";
import { awardPoints } from "@/modules/rewards/server/service";
import { notify } from "@/platform/notifications/service";
import { randomUUID } from "node:crypto";
import { z } from "zod";
import { all, one, run, tx } from "@/platform/db/client";
import { audit } from "@/platform/audit";
import { ActionError } from "@/platform/errors";
import { can, canManageResource, type Actor } from "@/platform/roles";
import { applyWorkflow, canEditContent, canViewContent, isContentStatus, type ContentStatus, type WorkflowAction } from "@/platform/workflow";
import { certificateCode, courseProgress, gradeQuiz, toEmbedUrl, validateQuestion, type Level, type ResourceKind, type Topic } from "../domain/learning";

/**
 * Education Hub use-cases. Every function takes the verified actor (or null for anonymous
 * browsing) and enforces permissions here — the UI only hides what the server would refuse.
 */
const now = () => new Date().toISOString();
const topic = z.enum(["finance", "development"]);
const MAX_ATTACHMENTS = 10;
const attachmentInput = z
  .array(z.object({ url: z.string().trim().max(500), name: z.string().trim().max(120).default("") }))
  .max(MAX_ATTACHMENTS, `Tối đa ${MAX_ATTACHMENTS} tệp / ảnh.`)
  .default([]);

const text = (max: number, msg: string) => z.string().trim().min(1, msg).max(max);
const who = (actor: Actor | null, authorId: string) => ({
  isAuthor: !!actor && actor.id === authorId,
  canApprove: can(actor, "edu.content.approve"),
});
const statusOf = (s: unknown): ContentStatus => (isContentStatus(s) ? s : "draft");

/**
 * Every member may contribute courses, quizzes and documents (they stay drafts until an approver publishes them).
 * Members without edu.content.create are limited to 10 new items a day (anti-spam).
 */
async function requireCreator(actor: Actor) {
  if (actor.locked) throw new ActionError("Tài khoản đang bị khóa.");
  if (!can(actor, "edu.content.create") && !(await allowAttempt(`edu-create:${actor.id}`, 10, 24 * 3600_000))) {
    throw new ActionError("Bạn đã tạo nhiều nội dung hôm nay. Hãy hoàn thiện và gửi duyệt các bản nháp trước.", "rate_limited");
  }
}

// ───────────────────────── Courses ─────────────────────────

export type CourseCard = {
  id: string;
  title: string;
  summary: string;
  topic: Topic;
  level: Level;
  status: ContentStatus;
  lessonCount: number;
  durationMin: number;
  learners: number;
  authorName: string;
};

const COURSE_CARD_SQL = `SELECT c.id, c.title, c.summary, c.topic, c.level, c.status, m.full_name AS author_name,
  (SELECT COUNT(*) FROM edu_lessons l WHERE l.course_id = c.id) AS lesson_count,
  (SELECT COALESCE(SUM(duration_min),0) FROM edu_lessons l WHERE l.course_id = c.id) AS duration_min,
  (SELECT COUNT(*) FROM edu_enrollments e WHERE e.course_id = c.id) AS learners
  FROM edu_courses c JOIN members m ON m.id = c.author_id`;

type CourseCardRow = { id: string; title: string; summary: string; topic: Topic; level: Level; status: string; author_name: string; lesson_count: number; duration_min: number; learners: number };
const toCard = (r: CourseCardRow): CourseCard => ({
  id: r.id,
  title: r.title,
  summary: r.summary,
  topic: r.topic,
  level: r.level,
  status: statusOf(r.status),
  lessonCount: Number(r.lesson_count),
  durationMin: Number(r.duration_min),
  learners: Number(r.learners),
  authorName: r.author_name,
});

const likeArg = (q: string) => `%${q.trim().replace(/[\\%_]/g, (m) => `\\${m}`)}%`;

export async function listPublishedCourses(f: { q?: string; topic?: string } = {}): Promise<CourseCard[]> {
  const where = ["c.status = 'published'"];
  const args: string[] = [];
  if (f.topic === "finance" || f.topic === "development") (where.push("c.topic = ?"), args.push(f.topic));
  if (f.q?.trim()) (where.push("(c.title LIKE ? ESCAPE '\\' OR c.summary LIKE ? ESCAPE '\\')"), args.push(likeArg(f.q), likeArg(f.q)));
  const rows = await all<CourseCardRow>(`${COURSE_CARD_SQL} WHERE ${where.join(" AND ")} ORDER BY c.published_at DESC LIMIT 100`, args);
  return rows.map(toCard);
}

export type Lesson = { id: string; position: number; title: string; kind: "video" | "reading"; videoUrl: string | null; embedUrl: string | null; body: string; durationMin: number; done: boolean };

export async function getCourse(actor: Actor | null, id: string) {
  const c = await one<CourseCardRow & { description: string; author_id: string; reject_reason: string | null }>(
    `${COURSE_CARD_SQL.replace("SELECT c.id,", "SELECT c.id, c.description, c.author_id, c.reject_reason,")} WHERE c.id = ?`,
    [id],
  );
  if (!c) return null;
  const w = who(actor, c.author_id);
  if (!canViewContent(statusOf(c.status), w)) return null;
  const lessons = await all<{ id: string; position: number; title: string; kind: "video" | "reading"; video_url: string | null; body: string; duration_min: number; done: string | null }>(
    `SELECT l.id, l.position, l.title, l.kind, l.video_url, l.body, l.duration_min, p.completed_at AS done
     FROM edu_lessons l LEFT JOIN edu_lesson_progress p ON p.lesson_id = l.id AND p.member_id = ?
     WHERE l.course_id = ? ORDER BY l.position`,
    [actor?.id ?? "", id],
  );
  const enrollment = actor
    ? await one<{ enrolled_at: string; completed_at: string | null }>("SELECT enrolled_at, completed_at FROM edu_enrollments WHERE member_id = ? AND course_id = ?", [actor.id, id])
    : null;
  const doneCount = lessons.filter((l) => l.done).length;
  return {
    ...toCard(c),
    description: c.description,
    authorId: c.author_id,
    rejectReason: c.reject_reason,
    lessons: lessons.map<Lesson>((l) => ({
      id: l.id,
      position: Number(l.position),
      title: l.title,
      kind: l.kind,
      videoUrl: l.video_url,
      embedUrl: l.video_url ? toEmbedUrl(l.video_url) : null,
      body: l.body,
      durationMin: Number(l.duration_min),
      done: !!l.done,
    })),
    enrolled: !!enrollment,
    completedAt: enrollment?.completed_at ?? null,
    progress: courseProgress(lessons.length, doneCount),
    canEdit: canEditContent(statusOf(c.status), w),
    canApprove: w.canApprove,
    isAuthor: w.isAuthor,
    canDelete: canManageResource(actor, c.author_id, "edu.content.delete_any") && (w.isAuthor ? ["draft", "rejected"].includes(c.status) || can(actor, "edu.content.delete_any") : true),
  };
}

const courseSchema = z.object({
  title: text(120, "Nhập tên khóa học."),
  summary: z.string().trim().max(200).default(""),
  description: z.string().trim().max(5000).default(""),
  topic,
  level: z.enum(["basic", "intermediate", "advanced"]),
});

export async function createCourse(actor: Actor, input: unknown): Promise<string> {
  await requireCreator(actor);
  const d = courseSchema.parse(input);
  const id = randomUUID();
  await run(
    "INSERT INTO edu_courses (id, author_id, title, summary, description, topic, level, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)",
    [id, actor.id, d.title, d.summary, d.description, d.topic, d.level, now(), now()],
  );
  return id;
}

async function loadOwned(table: "edu_courses" | "edu_quizzes" | "edu_resources", actor: Actor, id: string) {
  const row = await one<{ author_id: string; status: string }>(`SELECT author_id, status FROM ${table} WHERE id = ?`, [id]);
  if (!row) throw new ActionError("Không tìm thấy nội dung.");
  const w = who(actor, row.author_id);
  if (!canEditContent(statusOf(row.status), w)) {
    throw new ActionError(w.isAuthor ? "Nội dung đang chờ duyệt hoặc đã xuất bản — không sửa được." : "Bạn không có quyền sửa nội dung này.");
  }
  return row;
}

export async function updateCourse(actor: Actor, id: string, input: unknown): Promise<void> {
  const row = await loadOwned("edu_courses", actor, id);
  const d = courseSchema.parse(input);
  // An author edit on rejected content returns it to draft so it is re-reviewed.
  const status = row.status === "rejected" ? "draft" : row.status;
  await run("UPDATE edu_courses SET title = ?, summary = ?, description = ?, topic = ?, level = ?, status = ?, updated_at = ? WHERE id = ?", [
    d.title,
    d.summary,
    d.description,
    d.topic,
    d.level,
    status,
    now(),
    id,
  ]);
}

const lessonSchema = z
  .object({
    title: text(160, "Nhập tên bài học."),
    kind: z.enum(["video", "reading"]),
    videoUrl: z.string().trim().max(500).optional().default(""),
    body: z.string().trim().max(20000).default(""),
    durationMin: z.coerce.number().int().min(1).max(240).default(5),
  })
  .superRefine((v, ctx) => {
    if (v.kind === "video" && !toEmbedUrl(v.videoUrl)) ctx.addIssue({ code: "custom", message: "Link video phải là YouTube hoặc Vimeo (https)." });
    if (v.kind === "reading" && v.body.length < 20) ctx.addIssue({ code: "custom", message: "Bài đọc cần ít nhất 20 ký tự nội dung." });
  });

export async function addLesson(actor: Actor, courseId: string, input: unknown): Promise<string> {
  await loadOwned("edu_courses", actor, courseId);
  const d = lessonSchema.parse(input);
  const pos = await one<{ p: number }>("SELECT COALESCE(MAX(position), 0) + 1 AS p FROM edu_lessons WHERE course_id = ?", [courseId]);
  const id = randomUUID();
  await run("INSERT INTO edu_lessons (id, course_id, position, title, kind, video_url, body, duration_min) VALUES (?, ?, ?, ?, ?, ?, ?, ?)", [
    id,
    courseId,
    Number(pos?.p ?? 1),
    d.title,
    d.kind,
    d.kind === "video" ? d.videoUrl : null,
    d.body,
    d.durationMin,
  ]);
  await run("UPDATE edu_courses SET updated_at = ? WHERE id = ?", [now(), courseId]);
  return id;
}

async function lessonCourse(lessonId: string) {
  const l = await one<{ course_id: string; position: number }>("SELECT course_id, position FROM edu_lessons WHERE id = ?", [lessonId]);
  if (!l) throw new ActionError("Không tìm thấy bài học.");
  return l;
}

export async function updateLesson(actor: Actor, lessonId: string, input: unknown): Promise<void> {
  const l = await lessonCourse(lessonId);
  await loadOwned("edu_courses", actor, l.course_id);
  const d = lessonSchema.parse(input);
  await run("UPDATE edu_lessons SET title = ?, kind = ?, video_url = ?, body = ?, duration_min = ? WHERE id = ?", [
    d.title,
    d.kind,
    d.kind === "video" ? d.videoUrl : null,
    d.body,
    d.durationMin,
    lessonId,
  ]);
}

export async function deleteLesson(actor: Actor, lessonId: string): Promise<void> {
  const l = await lessonCourse(lessonId);
  await loadOwned("edu_courses", actor, l.course_id);
  await tx([
    { sql: "DELETE FROM edu_lessons WHERE id = ?", args: [lessonId] },
    { sql: "UPDATE edu_lessons SET position = position - 1 WHERE course_id = ? AND position > ?", args: [l.course_id, l.position] },
  ]);
}

export async function moveLesson(actor: Actor, lessonId: string, dir: -1 | 1): Promise<void> {
  const l = await lessonCourse(lessonId);
  await loadOwned("edu_courses", actor, l.course_id);
  const other = await one<{ id: string }>("SELECT id FROM edu_lessons WHERE course_id = ? AND position = ?", [l.course_id, Number(l.position) + dir]);
  if (!other) return;
  await tx([
    { sql: "UPDATE edu_lessons SET position = ? WHERE id = ?", args: [Number(l.position) + dir, lessonId] },
    { sql: "UPDATE edu_lessons SET position = ? WHERE id = ?", args: [Number(l.position), other.id] },
  ]);
}

/** Workflow transition on any Education content table, with per-type readiness checks. */
export async function transition(
  actor: Actor,
  kind: "course" | "quiz" | "resource",
  id: string,
  action: WorkflowAction,
  reason?: string,
): Promise<ContentStatus> {
  const table = { course: "edu_courses", quiz: "edu_quizzes", resource: "edu_resources" }[kind];
  const row = await one<{ author_id: string; status: string }>(`SELECT author_id, status FROM ${table} WHERE id = ?`, [id]);
  if (!row) throw new ActionError("Không tìm thấy nội dung.");
  const res = applyWorkflow(action, statusOf(row.status), who(actor, row.author_id), reason);
  if (!res.ok) throw new ActionError(res.error);
  if (res.to === "published" || res.to === "submitted") {
    if (kind === "course" && Number((await one<{ n: number }>("SELECT COUNT(*) AS n FROM edu_lessons WHERE course_id = ?", [id]))?.n) === 0) {
      throw new ActionError("Khóa học cần ít nhất một bài học.");
    }
    if (kind === "quiz" && Number((await one<{ n: number }>("SELECT COUNT(*) AS n FROM edu_questions WHERE quiz_id = ?", [id]))?.n) === 0) {
      throw new ActionError("Bài kiểm tra cần ít nhất một câu hỏi.");
    }
  }
  const extra = kind === "course" && res.to === "published" ? ", published_at = COALESCE(published_at, ?)" : "";
  const args: (string | null)[] = [res.to, res.to === "rejected" ? (reason ?? "").trim().slice(0, 500) : null, now()];
  if (extra) args.push(now());
  args.push(id);
  await run(`UPDATE ${table} SET status = ?, reject_reason = ?, updated_at = ?${extra} WHERE id = ?`, args);
  await audit(actor.id, `edu.${kind}.${action}`, `${kind}:${id}`, "success");
  if (row.author_id !== actor.id && (res.to === "published" || res.to === "rejected" || res.to === "archived")) {
    const label = { course: "Khóa học", quiz: "Bài kiểm tra", resource: "Tài liệu" }[kind];
    const href = { course: `/learn/manage/courses/${id}`, quiz: `/learn/manage/quizzes/${id}`, resource: `/learn/manage/resources/${id}` }[kind];
    const verb = res.to === "published" ? "đã được duyệt và công khai" : res.to === "rejected" ? "bị từ chối" : "đã bị gỡ";
    await notify(row.author_id, { category: "learn", title: `${label} của bạn ${verb}`, body: res.to === "rejected" ? `Lý do: ${(reason ?? "").trim().slice(0, 200)}` : "", href, dedupeKey: `edu:${kind}:${id}:${res.to}:${now()}` });
  }
  return res.to;
}

export async function deleteContent(actor: Actor, kind: "course" | "quiz" | "resource", id: string): Promise<void> {
  const table = { course: "edu_courses", quiz: "edu_quizzes", resource: "edu_resources" }[kind];
  const row = await one<{ author_id: string; status: string }>(`SELECT author_id, status FROM ${table} WHERE id = ?`, [id]);
  if (!row) throw new ActionError("Không tìm thấy nội dung.");
  const ownDraft = row.author_id === actor.id && (row.status === "draft" || row.status === "rejected");
  if (!ownDraft && !can(actor, "edu.content.delete_any")) {
    throw new ActionError(row.author_id === actor.id ? "Nội dung đã gửi duyệt/xuất bản: hãy gỡ thay vì xóa." : "Bạn không có quyền xóa nội dung của người khác.");
  }
  await run(`DELETE FROM ${table} WHERE id = ?`, [id]);
  await audit(actor.id, `edu.${kind}.delete`, `${kind}:${id}`, "success");
}

// ─────────────────── Enrollment & progress ───────────────────

async function publishedCourse(courseId: string) {
  const c = await one<{ status: string }>("SELECT status FROM edu_courses WHERE id = ?", [courseId]);
  if (!c || c.status !== "published") throw new ActionError("Khóa học không tồn tại hoặc chưa mở.");
}

export async function enroll(actor: Actor, courseId: string): Promise<void> {
  await publishedCourse(courseId);
  await run("INSERT OR IGNORE INTO edu_enrollments (member_id, course_id, enrolled_at) VALUES (?, ?, ?)", [actor.id, courseId, now()]);
}

/** Marks a lesson done (auto-enrols) and stamps course completion when all lessons are done. */
export async function completeLesson(actor: Actor, lessonId: string): Promise<{ courseCompleted: boolean }> {
  const l = await lessonCourse(lessonId);
  await enroll(actor, l.course_id);
  await run("INSERT OR IGNORE INTO edu_lesson_progress (member_id, lesson_id, completed_at) VALUES (?, ?, ?)", [actor.id, lessonId, now()]);
  const counts = await one<{ total: number; done: number }>(
    `SELECT (SELECT COUNT(*) FROM edu_lessons WHERE course_id = ?) AS total,
            (SELECT COUNT(*) FROM edu_lesson_progress p JOIN edu_lessons l ON l.id = p.lesson_id WHERE l.course_id = ? AND p.member_id = ?) AS done`,
    [l.course_id, l.course_id, actor.id],
  );
  const { completed } = courseProgress(Number(counts?.total), Number(counts?.done));
  if (completed) {
    const first = await run("UPDATE edu_enrollments SET completed_at = ? WHERE member_id = ? AND course_id = ? AND completed_at IS NULL", [now(), actor.id, l.course_id]);
    if (first) await awardPoints(actor.id, "course_complete", l.course_id);
  }
  return { courseCompleted: completed };
}

export async function myLearning(actor: Actor) {
  const rows = await all<CourseCardRow & { enrolled_at: string; completed_at: string | null; done: number }>(
    `${COURSE_CARD_SQL.replace("SELECT c.id,", "SELECT c.id, e.enrolled_at, e.completed_at, (SELECT COUNT(*) FROM edu_lesson_progress p JOIN edu_lessons l2 ON l2.id = p.lesson_id WHERE l2.course_id = c.id AND p.member_id = e.member_id) AS done,")}
     JOIN edu_enrollments e ON e.course_id = c.id WHERE e.member_id = ? ORDER BY e.enrolled_at DESC`,
    [actor.id],
  );
  const attempts = await all<{ quiz_id: string; title: string; best: number; total: number; passed: number; tries: number }>(
    `SELECT a.quiz_id, q.title, MAX(a.score) AS best, MAX(a.total) AS total, MAX(a.passed) AS passed, COUNT(*) AS tries
     FROM edu_attempts a JOIN edu_quizzes q ON q.id = a.quiz_id WHERE a.member_id = ? GROUP BY a.quiz_id ORDER BY MAX(a.created_at) DESC`,
    [actor.id],
  );
  const courses = rows.map((r) => ({ ...toCard(r), enrolledAt: r.enrolled_at, completedAt: r.completed_at, progress: courseProgress(Number(r.lesson_count), Number(r.done)) }));
  return {
    courses,
    attempts: attempts.map((a) => ({ quizId: a.quiz_id, title: a.title, best: Number(a.best), total: Number(a.total), passed: Number(a.passed) === 1, tries: Number(a.tries) })),
    stats: {
      enrolled: courses.length,
      completed: courses.filter((c) => c.completedAt).length,
      minutes: courses.reduce((a, c) => a + Math.round((c.durationMin * c.progress.pct) / 100), 0),
      quizzesPassed: attempts.filter((a) => Number(a.passed) === 1).length,
    },
  };
}

export async function certificate(actor: Actor, courseId: string) {
  const r = await one<{ title: string; completed_at: string | null; full_name: string }>(
    `SELECT c.title, e.completed_at, m.full_name FROM edu_enrollments e JOIN edu_courses c ON c.id = e.course_id JOIN members m ON m.id = e.member_id
     WHERE e.member_id = ? AND e.course_id = ?`,
    [actor.id, courseId],
  );
  if (!r?.completed_at) return null;
  return { courseTitle: r.title, memberName: r.full_name, completedAt: r.completed_at, code: certificateCode(actor.id, courseId) };
}

// ───────────────────────── Quizzes ─────────────────────────

export type QuizCard = { id: string; title: string; description: string; topic: Topic; subject: string; status: ContentStatus; questionCount: number; passPct: number; authorName: string; timeLimitMin: number | null };

const QUIZ_CARD_SQL = `SELECT q.id, q.title, q.description, q.topic, q.subject, q.status, q.pass_pct, q.time_limit_min, q.author_id, q.reject_reason, q.course_id, m.full_name AS author_name,
  (SELECT COUNT(*) FROM edu_questions x WHERE x.quiz_id = q.id) AS question_count
  FROM edu_quizzes q JOIN members m ON m.id = q.author_id`;
type QuizRow = { id: string; title: string; description: string; topic: Topic; subject: string; status: string; pass_pct: number; time_limit_min: number | null; author_id: string; reject_reason: string | null; course_id: string | null; author_name: string; question_count: number };
const toQuiz = (r: QuizRow): QuizCard => ({
  id: r.id,
  title: r.title,
  description: r.description,
  topic: r.topic,
  subject: r.subject,
  status: statusOf(r.status),
  questionCount: Number(r.question_count),
  passPct: Number(r.pass_pct),
  authorName: r.author_name,
  timeLimitMin: r.time_limit_min === null ? null : Number(r.time_limit_min),
});

export async function listPublishedQuizzes(f: { topic?: string } = {}): Promise<QuizCard[]> {
  const t = f.topic === "finance" || f.topic === "development" ? f.topic : null;
  const rows = await all<QuizRow>(`${QUIZ_CARD_SQL} WHERE q.status = 'published' ${t ? "AND q.topic = ?" : ""} ORDER BY q.updated_at DESC LIMIT 100`, t ? [t] : []);
  return rows.map(toQuiz);
}

/** For taking a quiz: never includes the correct answers (graded server-side). */
export async function getQuizForTaking(actor: Actor | null, id: string) {
  const q = await one<QuizRow>(`${QUIZ_CARD_SQL} WHERE q.id = ?`, [id]);
  if (!q || !canViewContent(statusOf(q.status), who(actor, q.author_id))) return null;
  const questions = await all<{ id: string; prompt: string; options_json: string }>("SELECT id, prompt, options_json FROM edu_questions WHERE quiz_id = ? ORDER BY position", [id]);
  const att = await listAttachments("quiz", [id]);
  return { ...toQuiz(q), attachments: att.get(id) ?? [], questions: questions.map((x) => ({ id: x.id, prompt: x.prompt, options: JSON.parse(x.options_json) as string[] })) };
}

/** For the editor: full questions incl. answers; only for people who may edit. */
export async function getQuizForEditing(actor: Actor, id: string) {
  const q = await one<QuizRow>(`${QUIZ_CARD_SQL} WHERE q.id = ?`, [id]);
  if (!q) return null;
  const w = who(actor, q.author_id);
  if (!w.isAuthor && !w.canApprove) return null;
  const questions = await all<{ id: string; prompt: string; options_json: string; correct_index: number; explanation: string; difficulty: string }>(
    "SELECT id, prompt, options_json, correct_index, explanation, difficulty FROM edu_questions WHERE quiz_id = ? ORDER BY position",
    [id],
  );
  const att = await listAttachments("quiz", [id]);
  return {
    ...toQuiz(q),
    attachments: att.get(id) ?? [],
    courseId: q.course_id,
    rejectReason: q.reject_reason,
    canEdit: canEditContent(statusOf(q.status), w),
    canApprove: w.canApprove,
    isAuthor: w.isAuthor,
    questions: questions.map((x) => ({ id: x.id, prompt: x.prompt, options: JSON.parse(x.options_json) as string[], correctIndex: Number(x.correct_index), explanation: x.explanation, difficulty: x.difficulty })),
  };
}

const quizSchema = z.object({
  title: text(120, "Nhập tên bài kiểm tra."),
  description: z.string().trim().max(1000).default(""),
  topic,
  subject: z.string().trim().max(80, "Tên môn tối đa 80 ký tự.").default(""),
  attachments: attachmentInput,
  passPct: z.coerce.number().int().min(1, "Điểm đạt 1–100%.").max(100, "Điểm đạt 1–100%."),
  timeLimitMin: z.preprocess((v) => (v === "" || v === null || v === undefined || v === 0 ? null : v), z.union([z.null(), z.coerce.number().int().min(1, "Thời gian 1–180 phút.").max(180, "Thời gian 1–180 phút.")])),
});

export async function createQuiz(actor: Actor, input: unknown): Promise<string> {
  await requireCreator(actor);
  const d = quizSchema.parse(input);
  const id = randomUUID();
  await run("INSERT INTO edu_quizzes (id, author_id, title, description, topic, subject, pass_pct, time_limit_min, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)", [
    id,
    actor.id,
    d.title,
    d.description,
    d.topic,
    d.subject,
    d.passPct,
    d.timeLimitMin,
    now(),
    now(),
  ]);
  await setAttachments(actor, "quiz", id, d.attachments);
  return id;
}

export async function updateQuiz(actor: Actor, id: string, input: unknown): Promise<void> {
  const row = await loadOwned("edu_quizzes", actor, id);
  const d = quizSchema.parse(input);
  await run("UPDATE edu_quizzes SET title = ?, description = ?, topic = ?, subject = ?, pass_pct = ?, time_limit_min = ?, status = ?, updated_at = ? WHERE id = ?", [
    d.title,
    d.description,
    d.topic,
    d.subject,
    d.passPct,
    d.timeLimitMin,
    row.status === "rejected" ? "draft" : row.status,
    now(),
    id,
  ]);
  await setAttachments(actor, "quiz", id, d.attachments);
}

const questionSchema = z.object({
  prompt: text(500, "Nhập câu hỏi."),
  options: z.array(z.string().max(200)).max(6),
  correctIndex: z.coerce.number().int(),
  explanation: z.string().trim().max(1000).default(""),
  difficulty: z.enum(["basic", "intermediate", "advanced"]).default("basic"),
});

export async function saveQuestion(actor: Actor, quizId: string, questionId: string | null, input: unknown): Promise<string> {
  await loadOwned("edu_quizzes", actor, quizId);
  const d = questionSchema.parse(input);
  const err = validateQuestion(d.options, d.correctIndex);
  if (err) throw new ActionError(err);
  const options = JSON.stringify(d.options.map((o) => o.trim()));
  if (questionId) {
    const n = await run("UPDATE edu_questions SET prompt = ?, options_json = ?, correct_index = ?, explanation = ?, difficulty = ? WHERE id = ? AND quiz_id = ?", [
      d.prompt,
      options,
      d.correctIndex,
      d.explanation,
      d.difficulty,
      questionId,
      quizId,
    ]);
    if (n === 0) throw new ActionError("Không tìm thấy câu hỏi.");
    return questionId;
  }
  const pos = await one<{ p: number }>("SELECT COALESCE(MAX(position), 0) + 1 AS p FROM edu_questions WHERE quiz_id = ?", [quizId]);
  const id = randomUUID();
  await run("INSERT INTO edu_questions (id, quiz_id, position, prompt, options_json, correct_index, explanation, difficulty) VALUES (?, ?, ?, ?, ?, ?, ?, ?)", [
    id,
    quizId,
    Number(pos?.p ?? 1),
    d.prompt,
    options,
    d.correctIndex,
    d.explanation,
    d.difficulty,
  ]);
  return id;
}

export async function deleteQuestion(actor: Actor, quizId: string, questionId: string): Promise<void> {
  await loadOwned("edu_quizzes", actor, quizId);
  await run("DELETE FROM edu_questions WHERE id = ? AND quiz_id = ?", [questionId, quizId]);
}

/** Timed quizzes: the clock starts on the server; pressing "Bắt đầu" again restarts it. */
export async function startAttempt(actor: Actor, quizId: string): Promise<{ deadline: string | null }> {
  const q = await one<{ status: string; time_limit_min: number | null }>("SELECT status, time_limit_min FROM edu_quizzes WHERE id = ?", [quizId]);
  if (!q || q.status !== "published") throw new ActionError("Bài kiểm tra không tồn tại hoặc chưa mở.");
  if (q.time_limit_min === null) return { deadline: null };
  const t = new Date();
  await run("INSERT INTO edu_attempt_starts (quiz_id, member_id, started_at) VALUES (?, ?, ?) ON CONFLICT(quiz_id, member_id) DO UPDATE SET started_at = excluded.started_at", [quizId, actor.id, t.toISOString()]);
  return { deadline: new Date(t.getTime() + Number(q.time_limit_min) * 60_000).toISOString() };
}

/** Grace for network delay when the timer auto-submits. */
export const QUIZ_GRACE_MS = 60_000;

export async function submitAttempt(actor: Actor, quizId: string, answers: unknown): Promise<string> {
  const q = await one<{ status: string; pass_pct: number; time_limit_min: number | null }>("SELECT status, pass_pct, time_limit_min FROM edu_quizzes WHERE id = ?", [quizId]);
  if (!q || q.status !== "published") throw new ActionError("Bài kiểm tra không tồn tại hoặc chưa mở.");
  if (q.time_limit_min !== null) {
    const s = await one<{ started_at: string }>("SELECT started_at FROM edu_attempt_starts WHERE quiz_id = ? AND member_id = ?", [quizId, actor.id]);
    if (!s) throw new ActionError("Bấm “Bắt đầu” để tính giờ trước khi làm bài.");
    if (Date.now() > Date.parse(s.started_at) + Number(q.time_limit_min) * 60_000 + QUIZ_GRACE_MS) {
      await run("DELETE FROM edu_attempt_starts WHERE quiz_id = ? AND member_id = ?", [quizId, actor.id]);
      throw new ActionError("Đã hết giờ làm bài. Bấm “Bắt đầu” để làm lại.");
    }
    await run("DELETE FROM edu_attempt_starts WHERE quiz_id = ? AND member_id = ?", [quizId, actor.id]);
  }
  const questions = await all<{ id: string; correct_index: number; options_json: string }>("SELECT id, correct_index, options_json FROM edu_questions WHERE quiz_id = ? ORDER BY position", [quizId]);
  const a = answers && typeof answers === "object" ? (answers as Record<string, unknown>) : {};
  const r = gradeQuiz(
    questions.map((x) => ({ id: x.id, correctIndex: Number(x.correct_index), optionCount: (JSON.parse(x.options_json) as string[]).length })),
    a,
    Number(q.pass_pct),
  );
  const id = randomUUID();
  await run("INSERT INTO edu_attempts (id, quiz_id, member_id, answers_json, score, total, passed, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)", [
    id,
    quizId,
    actor.id,
    JSON.stringify(Object.fromEntries(r.detail.map((d) => [d.questionId, d.chosen]))),
    r.score,
    r.total,
    r.passed ? 1 : 0,
    now(),
  ]);
  if (r.passed) await awardPoints(actor.id, "quiz_pass", quizId);
  return id;
}

/** Result with answers & explanations — only the person who made the attempt can see it. */
export async function getAttempt(actor: Actor, attemptId: string) {
  const a = await one<{ quiz_id: string; member_id: string; answers_json: string; score: number; total: number; passed: number; created_at: string; title: string; pass_pct: number }>(
    "SELECT a.*, q.title, q.pass_pct FROM edu_attempts a JOIN edu_quizzes q ON q.id = a.quiz_id WHERE a.id = ?",
    [attemptId],
  );
  if (!a || a.member_id !== actor.id) return null;
  const answers = JSON.parse(a.answers_json) as Record<string, number | null>;
  const questions = await all<{ id: string; prompt: string; options_json: string; correct_index: number; explanation: string }>(
    "SELECT id, prompt, options_json, correct_index, explanation FROM edu_questions WHERE quiz_id = ? ORDER BY position",
    [a.quiz_id],
  );
  return {
    quizId: a.quiz_id,
    title: a.title,
    score: Number(a.score),
    total: Number(a.total),
    passPct: Number(a.pass_pct),
    passed: Number(a.passed) === 1,
    createdAt: a.created_at,
    questions: questions.map((x) => ({
      id: x.id,
      prompt: x.prompt,
      options: JSON.parse(x.options_json) as string[],
      correctIndex: Number(x.correct_index),
      chosen: answers[x.id] ?? null,
      explanation: x.explanation,
    })),
  };
}

// ───────────────────────── Attachments (photos & files on resources / quizzes) ─────────────────────────

export type Attachment = { id: string; kind: "image" | "file"; url: string; name: string };
type AttachOwner = "resource" | "quiz" | "lesson";

export async function listAttachments(owner: AttachOwner, ids: string[]): Promise<Map<string, Attachment[]>> {
  const out = new Map<string, Attachment[]>();
  if (!ids.length) return out;
  const rows = await all<{ id: string; owner_id: string; kind: "image" | "file"; url: string; name: string }>(
    `SELECT id, owner_id, kind, url, name FROM edu_attachments WHERE owner_type = ? AND owner_id IN (${ids.map(() => "?").join(",")}) ORDER BY position`,
    [owner, ...ids],
  );
  for (const r of rows) (out.get(r.owner_id) ?? out.set(r.owner_id, []).get(r.owner_id)!).push({ id: r.id, kind: r.kind, url: r.url, name: r.name });
  return out;
}

/** Replaces the attachments of one item. Each URL must already be attached to it, or be the actor's own upload. */
async function setAttachments(actor: Actor, owner: AttachOwner, ownerId: string, input: z.infer<typeof attachmentInput>): Promise<void> {
  const current = new Set((await listAttachments(owner, [ownerId])).get(ownerId)?.map((a) => a.url));
  const seen = new Set<string>();
  const items: { url: string; name: string }[] = [];
  for (const a of input) {
    if (seen.has(a.url)) continue;
    seen.add(a.url);
    if (!current.has(a.url) && !(await isOwnAttachment(actor, a.url))) throw new ActionError("Tệp không hợp lệ hoặc không phải của bạn.");
    items.push(a);
  }
  await run("DELETE FROM edu_attachments WHERE owner_type = ? AND owner_id = ?", [owner, ownerId]);
  for (const [i, a] of items.entries()) {
    await run("INSERT INTO edu_attachments (id, owner_type, owner_id, kind, url, name, position, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)", [
      randomUUID(),
      owner,
      ownerId,
      a.url.endsWith(".webp") ? "image" : "file",
      a.url,
      a.name || "tai-lieu",
      i,
      now(),
    ]);
  }
}

// ───────────────────────── Resources ─────────────────────────

const RESOURCE_KINDS = ["ebook", "template", "checklist", "article", "exercise", "notes", "exam"] as const;
export type Resource = {
  id: string;
  title: string;
  kind: ResourceKind;
  topic: Topic;
  subject: string;
  url: string;
  description: string;
  status: ContentStatus;
  authorId: string;
  rejectReason: string | null;
  quizId: string | null;
  quizTitle: string | null;
  attachments: Attachment[];
};
type ResRow = { id: string; title: string; kind: ResourceKind; topic: Topic; subject: string; url: string; description: string; status: string; author_id: string; reject_reason: string | null; quiz_id: string | null; quiz_title: string | null };
const RES_SQL = "SELECT r.*, (SELECT title FROM edu_quizzes q WHERE q.id = r.quiz_id) AS quiz_title FROM edu_resources r";
const toRes = (r: ResRow, attachments: Attachment[]): Resource => ({
  id: r.id,
  title: r.title,
  kind: r.kind,
  topic: r.topic,
  subject: r.subject,
  url: r.url,
  description: r.description,
  status: statusOf(r.status),
  authorId: r.author_id,
  rejectReason: r.reject_reason,
  quizId: r.quiz_id,
  quizTitle: r.quiz_title,
  attachments,
});

export async function listPublishedResources(f: { topic?: string; kind?: string; subject?: string } = {}): Promise<Resource[]> {
  const where = ["r.status = 'published'"];
  const args: string[] = [];
  if (f.topic === "finance" || f.topic === "development") (where.push("r.topic = ?"), args.push(f.topic));
  if (f.kind && (RESOURCE_KINDS as readonly string[]).includes(f.kind)) (where.push("r.kind = ?"), args.push(f.kind));
  if (f.subject?.trim()) (where.push("r.subject = ?"), args.push(f.subject.trim()));
  const rows = await all<ResRow>(`${RES_SQL} WHERE ${where.join(" AND ")} ORDER BY r.updated_at DESC LIMIT 200`, args);
  const att = await listAttachments("resource", rows.map((r) => r.id));
  return rows.map((r) => toRes(r, att.get(r.id) ?? []));
}

/** Subjects (môn) used by published documents and quizzes, for the filter chips. */
export async function listSubjects(): Promise<string[]> {
  const rows = await all<{ subject: string }>(
    `SELECT subject FROM (SELECT subject FROM edu_resources WHERE status = 'published' UNION SELECT subject FROM edu_quizzes WHERE status = 'published') WHERE subject <> '' ORDER BY subject LIMIT 40`,
  );
  return rows.map((r) => r.subject);
}

const resourceSchema = z
  .object({
    title: text(160, "Nhập tên tài liệu."),
    kind: z.enum(RESOURCE_KINDS),
    topic,
    subject: z.string().trim().max(80, "Tên môn tối đa 80 ký tự.").default(""),
    url: z
      .string()
      .trim()
      .max(500)
      .default("")
      .refine((u) => u === "" || u.startsWith("https://") || /^\/api\/files\/(document|attachment)\/[0-9a-f-]{36}\.(pdf|docx|xlsx|pptx|txt|csv)$/.test(u), "Link phải bắt đầu bằng https:// (hoặc tải lên tệp)."),
    description: z.string().trim().max(1000).default(""),
    quizId: z.string().trim().max(64).nullable().optional(),
    attachments: attachmentInput,
  })
  .refine((v) => v.url !== "" || v.attachments.length > 0, { message: "Đính kèm ít nhất một tệp / ảnh chụp hoặc dán link tài liệu.", path: ["url"] });

/** Uploaded PDFs must be the author's own upload; external links stay https. */
async function checkResourceUrl(actor: Actor, url: string) {
  if (!url) return;
  const ours = url.startsWith("/api/files/") || (await all("SELECT 1 AS x FROM uploads WHERE url = ?", [url])).length > 0;
  if (ours && !(await isOwnDocument(actor, url)) && !(await isOwnAttachment(actor, url))) throw new ActionError("Tệp tài liệu không hợp lệ hoặc không phải của bạn.");
}

/** A resource may point to a published quiz or one of the author's own quizzes. */
async function checkQuizLink(actor: Actor, quizId: string | null | undefined): Promise<string | null> {
  if (!quizId) return null;
  const q = await one<{ author_id: string; status: string }>("SELECT author_id, status FROM edu_quizzes WHERE id = ?", [quizId]);
  if (!q || (q.status !== "published" && q.author_id !== actor.id)) throw new ActionError("Bài kiểm tra không tồn tại hoặc chưa xuất bản.");
  return quizId;
}

export async function saveResource(actor: Actor, id: string | null, input: unknown): Promise<string> {
  const d = resourceSchema.parse(input);
  await checkResourceUrl(actor, d.url);
  const quizId = await checkQuizLink(actor, d.quizId);
  if (id) {
    const row = await loadOwned("edu_resources", actor, id);
    await run("UPDATE edu_resources SET title = ?, kind = ?, topic = ?, subject = ?, url = ?, description = ?, quiz_id = ?, status = ?, updated_at = ? WHERE id = ?", [
      d.title,
      d.kind,
      d.topic,
      d.subject,
      d.url,
      d.description,
      quizId,
      row.status === "rejected" ? "draft" : row.status,
      now(),
      id,
    ]);
    await setAttachments(actor, "resource", id, d.attachments);
    return id;
  }
  await requireCreator(actor);
  const newId = randomUUID();
  await run("INSERT INTO edu_resources (id, author_id, title, kind, topic, subject, url, description, quiz_id, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)", [
    newId,
    actor.id,
    d.title,
    d.kind,
    d.topic,
    d.subject,
    d.url,
    d.description,
    quizId,
    now(),
    now(),
  ]);
  await setAttachments(actor, "resource", newId, d.attachments);
  return newId;
}

export async function getResource(actor: Actor, id: string) {
  const r = await one<ResRow>(`${RES_SQL} WHERE r.id = ?`, [id]);
  if (!r) return null;
  const w = who(actor, r.author_id);
  if (!w.isAuthor && !w.canApprove) return null;
  const att = await listAttachments("resource", [id]);
  return { ...toRes(r, att.get(id) ?? []), canEdit: canEditContent(statusOf(r.status), w), canApprove: w.canApprove, isAuthor: w.isAuthor };
}

/** Reader view of one published document (anyone may read published content). */
export async function getPublishedResource(id: string): Promise<Resource | null> {
  const r = await one<ResRow>(`${RES_SQL} WHERE r.id = ? AND r.status = 'published'`, [id]);
  if (!r) return null;
  return toRes(r, (await listAttachments("resource", [id])).get(id) ?? []);
}

/** Quizzes the member may link to a document: published ones plus their own. */
export async function linkableQuizzes(actor: Actor): Promise<{ id: string; title: string }[]> {
  return all<{ id: string; title: string }>("SELECT id, title FROM edu_quizzes WHERE status = 'published' OR author_id = ? ORDER BY title LIMIT 100", [actor.id]);
}

// ───────────────────── Content management ─────────────────────

export type ManagedItem = { kind: "course" | "quiz" | "resource"; id: string; title: string; status: ContentStatus; authorName: string; updatedAt: string; rejectReason: string | null };

export async function manageOverview(actor: Actor) {
  const canCreate = !actor.locked; // every member contributes; approval still required
  const canApprove = can(actor, "edu.content.approve");
  const mine = await all<{ kind: ManagedItem["kind"]; id: string; title: string; status: string; author_name: string; updated_at: string; reject_reason: string | null }>(
    `SELECT 'course' AS kind, c.id, c.title, c.status, m.full_name AS author_name, c.updated_at AS updated_at, c.reject_reason FROM edu_courses c JOIN members m ON m.id = c.author_id WHERE c.author_id = ?
     UNION ALL SELECT 'quiz', q.id, q.title, q.status, m.full_name, q.updated_at, q.reject_reason FROM edu_quizzes q JOIN members m ON m.id = q.author_id WHERE q.author_id = ?
     UNION ALL SELECT 'resource', r.id, r.title, r.status, m.full_name, r.updated_at, r.reject_reason FROM edu_resources r JOIN members m ON m.id = r.author_id WHERE r.author_id = ?
     ORDER BY updated_at DESC`,
    [actor.id, actor.id, actor.id],
  );
  const queue = can(actor, "edu.content.approve")
    ? await all<typeof mine[number]>(
        `SELECT 'course' AS kind, c.id, c.title, c.status, m.full_name AS author_name, c.updated_at AS updated_at, c.reject_reason FROM edu_courses c JOIN members m ON m.id = c.author_id WHERE c.status = 'submitted'
         UNION ALL SELECT 'quiz', q.id, q.title, q.status, m.full_name, q.updated_at, q.reject_reason FROM edu_quizzes q JOIN members m ON m.id = q.author_id WHERE q.status = 'submitted'
         UNION ALL SELECT 'resource', r.id, r.title, r.status, m.full_name, r.updated_at, r.reject_reason FROM edu_resources r JOIN members m ON m.id = r.author_id WHERE r.status = 'submitted'
         ORDER BY updated_at`,
      )
    : [];
  const map = (r: (typeof mine)[number]): ManagedItem => ({ kind: r.kind, id: r.id, title: r.title, status: statusOf(r.status), authorName: r.author_name, updatedAt: r.updated_at, rejectReason: r.reject_reason });
  return { mine: mine.map(map), queue: queue.map(map), canCreate, canApprove };
}

// ───────────────────────── Forum ─────────────────────────

export const FORUM_TOPICS = { finance: "Tài chính", development: "Phát triển bản thân", career: "Sự nghiệp", question: "Hỏi đáp" } as const;
export type ForumTopic = keyof typeof FORUM_TOPICS;

export async function listThreads(actor: Actor | null, f: { topic?: string; q?: string } = {}) {
  const mod = can(actor, "edu.forum.moderate");
  const where = [mod ? "1=1" : "(t.hidden = 0 OR t.author_id = ?)"];
  const args: string[] = mod ? [] : [actor?.id ?? ""];
  if (f.topic && f.topic in FORUM_TOPICS) (where.push("t.topic = ?"), args.push(f.topic));
  if (f.q?.trim()) (where.push("(t.title LIKE ? ESCAPE '\\' OR t.body LIKE ? ESCAPE '\\')"), args.push(likeArg(f.q), likeArg(f.q)));
  const rows = await all<{ id: string; title: string; body: string; topic: ForumTopic; hidden: number; locked: number; created_at: string; last_activity_at: string; author_name: string; replies: number; likes: number }>(
    `SELECT t.id, t.title, t.body, t.topic, t.hidden, t.locked, t.created_at, t.last_activity_at, m.full_name AS author_name,
       (SELECT COUNT(*) FROM edu_replies r WHERE r.thread_id = t.id AND r.hidden = 0) AS replies,
       (SELECT COUNT(*) FROM edu_thread_likes l WHERE l.thread_id = t.id) AS likes
     FROM edu_threads t JOIN members m ON m.id = t.author_id WHERE ${where.join(" AND ")} ORDER BY t.last_activity_at DESC LIMIT 100`,
    args,
  );
  return rows.map((r) => ({ ...r, hidden: Number(r.hidden) === 1, locked: Number(r.locked) === 1, replies: Number(r.replies), likes: Number(r.likes) }));
}

export async function getThread(actor: Actor | null, id: string) {
  const t = await one<{ id: string; author_id: string; title: string; body: string; topic: ForumTopic; hidden: number; locked: number; created_at: string; author_name: string }>(
    "SELECT t.*, m.full_name AS author_name FROM edu_threads t JOIN members m ON m.id = t.author_id WHERE t.id = ?",
    [id],
  );
  if (!t) return null;
  const mod = can(actor, "edu.forum.moderate");
  const isAuthor = !!actor && actor.id === t.author_id;
  if (Number(t.hidden) === 1 && !mod && !isAuthor) return null;
  const replies = await all<{ id: string; author_id: string; body: string; hidden: number; created_at: string; author_name: string; parent_id: string | null }>(
    `SELECT r.id, r.author_id, r.body, r.hidden, r.created_at, r.parent_id, m.full_name AS author_name FROM edu_replies r JOIN members m ON m.id = r.author_id
     WHERE r.thread_id = ? ${mod ? "" : "AND (r.hidden = 0 OR r.author_id = ?)"} ORDER BY r.created_at`,
    mod ? [id] : [id, actor?.id ?? ""],
  );
  const likes = await one<{ n: number; mine: number }>("SELECT COUNT(*) AS n, SUM(member_id = ?) AS mine FROM edu_thread_likes WHERE thread_id = ?", [actor?.id ?? "", id]);
  return {
    id: t.id,
    title: t.title,
    body: t.body,
    topic: t.topic,
    hidden: Number(t.hidden) === 1,
    locked: Number(t.locked) === 1,
    createdAt: t.created_at,
    authorName: t.author_name,
    isAuthor,
    canModerate: mod,
    likes: Number(likes?.n ?? 0),
    liked: Number(likes?.mine ?? 0) > 0,
    replies: replies.map((r) => ({ id: r.id, parentId: r.parent_id, body: r.body, hidden: Number(r.hidden) === 1, createdAt: r.created_at, authorName: r.author_name, isAuthor: !!actor && actor.id === r.author_id })),
  };
}

const threadSchema = z.object({
  topic: z.enum(["finance", "development", "career", "question"]),
  title: z.string().trim().min(5, "Tiêu đề tối thiểu 5 ký tự.").max(160),
  body: z.string().trim().min(10, "Nội dung tối thiểu 10 ký tự.").max(10000),
});

export async function createThread(actor: Actor, input: unknown): Promise<string> {
  const d = threadSchema.parse(input);
  const id = randomUUID();
  await run("INSERT INTO edu_threads (id, author_id, topic, title, body, created_at, last_activity_at) VALUES (?, ?, ?, ?, ?, ?, ?)", [id, actor.id, d.topic, d.title, d.body, now(), now()]);
  return id;
}

export async function reply(actor: Actor, threadId: string, body: unknown, parentId?: string | null): Promise<void> {
  const b = z.string().trim().min(1, "Nhập nội dung trả lời.").max(5000).parse(body);
  let parent: { id: string; author_id: string } | null = null;
  if (parentId) {
    const p = await one<{ id: string; author_id: string; parent_id: string | null; hidden: number }>("SELECT id, author_id, parent_id, hidden FROM edu_replies WHERE id = ? AND thread_id = ?", [parentId, threadId]);
    if (!p || Number(p.hidden) === 1) throw new ActionError("Bình luận gốc không còn.");
    // One level of nesting: answering a reply attaches to its top-level comment.
    parent = p.parent_id ? await one<{ id: string; author_id: string }>("SELECT id, author_id FROM edu_replies WHERE id = ?", [p.parent_id]) : { id: p.id, author_id: p.author_id };
    if (p.parent_id && p.author_id !== parent?.author_id && p.author_id !== actor.id) {
      await notify(p.author_id, { category: "learn", title: "Có người trả lời bình luận của bạn", body: b.slice(0, 120), href: `/learn/forum/${threadId}` });
    }
  }
  const t = await one<{ hidden: number; locked: number; author_id: string; title: string }>("SELECT hidden, locked, author_id, title FROM edu_threads WHERE id = ?", [threadId]);
  if (!t || Number(t.hidden) === 1) throw new ActionError("Không tìm thấy chủ đề.");
  if (Number(t.locked) === 1) throw new ActionError("Chủ đề đã bị khóa bình luận.");
  await tx([
    { sql: "INSERT INTO edu_replies (id, thread_id, author_id, body, parent_id, created_at) VALUES (?, ?, ?, ?, ?, ?)", args: [randomUUID(), threadId, actor.id, b, parent?.id ?? null, now()] },
    { sql: "UPDATE edu_threads SET last_activity_at = ? WHERE id = ?", args: [now(), threadId] },
  ]);
  if (t.author_id !== actor.id) {
    await notify(t.author_id, { category: "learn", title: "Có trả lời mới trong chủ đề của bạn", body: t.title.slice(0, 120), href: `/learn/forum/${threadId}` });
  }
  if (parent && parent.author_id !== actor.id && parent.author_id !== t.author_id) {
    await notify(parent.author_id, { category: "learn", title: "Có người trả lời bình luận của bạn", body: b.slice(0, 120), href: `/learn/forum/${threadId}` });
  }
}

export async function toggleLike(actor: Actor, threadId: string): Promise<boolean> {
  const t = await one("SELECT id FROM edu_threads WHERE id = ? AND hidden = 0", [threadId]);
  if (!t) throw new ActionError("Không tìm thấy chủ đề.");
  const removed = await run("DELETE FROM edu_thread_likes WHERE thread_id = ? AND member_id = ?", [threadId, actor.id]);
  if (removed > 0) return false;
  await run("INSERT INTO edu_thread_likes (thread_id, member_id) VALUES (?, ?)", [threadId, actor.id]);
  return true;
}

/** Moderation (hide / lock) — never deletes, so the decision stays auditable (FR-X-004). */
export async function moderateThread(actor: Actor, threadId: string, change: { hidden?: boolean; locked?: boolean }): Promise<void> {
  if (!can(actor, "edu.forum.moderate")) throw new ActionError("Bạn không có quyền kiểm duyệt diễn đàn.");
  const sets: string[] = [];
  const args: (number | string)[] = [];
  if (change.hidden !== undefined) (sets.push("hidden = ?"), args.push(change.hidden ? 1 : 0));
  if (change.locked !== undefined) (sets.push("locked = ?"), args.push(change.locked ? 1 : 0));
  if (!sets.length) return;
  const n = await run(`UPDATE edu_threads SET ${sets.join(", ")} WHERE id = ?`, [...args, threadId]);
  if (n === 0) throw new ActionError("Không tìm thấy chủ đề.");
  await audit(actor.id, `edu.forum.moderate:${JSON.stringify(change)}`, `thread:${threadId}`, "success");
}

export async function moderateReply(actor: Actor, replyId: string, hidden: boolean): Promise<void> {
  if (!can(actor, "edu.forum.moderate")) throw new ActionError("Bạn không có quyền kiểm duyệt diễn đàn.");
  const n = await run("UPDATE edu_replies SET hidden = ? WHERE id = ?", [hidden ? 1 : 0, replyId]);
  if (n === 0) throw new ActionError("Không tìm thấy bình luận.");
  await audit(actor.id, hidden ? "edu.reply.hide" : "edu.reply.show", `reply:${replyId}`, "success");
}

/** Authors may delete their own thread/reply; nobody deletes other people's posts (moderators hide). */
export async function deleteOwnPost(actor: Actor, kind: "thread" | "reply", id: string): Promise<void> {
  const table = kind === "thread" ? "edu_threads" : "edu_replies";
  const row = await one<{ author_id: string }>(`SELECT author_id FROM ${table} WHERE id = ?`, [id]);
  if (!row) throw new ActionError("Không tìm thấy bài viết.");
  if (row.author_id !== actor.id) throw new ActionError("Bạn chỉ xóa được bài viết của chính mình.");
  await run(`DELETE FROM ${table} WHERE id = ?`, [id]);
}

export async function eduHomeStats() {
  const r = await one<{ courses: number; quizzes: number; resources: number; threads: number }>(
    `SELECT (SELECT COUNT(*) FROM edu_courses WHERE status = 'published') AS courses,
            (SELECT COUNT(*) FROM edu_quizzes WHERE status = 'published') AS quizzes,
            (SELECT COUNT(*) FROM edu_resources WHERE status = 'published') AS resources,
            (SELECT COUNT(*) FROM edu_threads WHERE hidden = 0) AS threads`,
  );
  return { courses: Number(r?.courses ?? 0), quizzes: Number(r?.quizzes ?? 0), resources: Number(r?.resources ?? 0), threads: Number(r?.threads ?? 0) };
}

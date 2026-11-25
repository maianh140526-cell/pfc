import { createHash } from "node:crypto";

/** Education domain (pure). FR-EDU-001/004/005, EDU-15. */
export type Topic = "finance" | "development";
export const TOPIC_LABEL: Record<Topic, string> = { finance: "Tài chính cá nhân", development: "Phát triển bản thân" };
export const LEVEL_LABEL = { basic: "Cơ bản", intermediate: "Trung cấp", advanced: "Nâng cao" } as const;
export type Level = keyof typeof LEVEL_LABEL;
export const RESOURCE_KIND_LABEL = { ebook: "eBook", template: "Template", checklist: "Checklist", article: "Bài viết", exercise: "Bài tập", notes: "Ghi chú / bài giảng", exam: "Đề kiểm tra" } as const;
export type ResourceKind = keyof typeof RESOURCE_KIND_LABEL;

/**
 * Only well-known video hosts are embedded (no arbitrary iframes). Returns a privacy-friendly
 * embed URL, or null if the link is not a supported video.
 */
export function toEmbedUrl(raw: string): string | null {
  let u: URL;
  try {
    u = new URL(raw.trim());
  } catch {
    return null;
  }
  if (u.protocol !== "https:") return null;
  const host = u.hostname.replace(/^www\./, "").replace(/^m\./, "");
  const idOk = (id: string | null | undefined) => (id && /^[A-Za-z0-9_-]{6,20}$/.test(id) ? id : null);
  if (host === "youtube.com") {
    const id = u.pathname === "/watch" ? idOk(u.searchParams.get("v")) : idOk(u.pathname.match(/^\/(?:embed|shorts)\/([^/]+)/)?.[1]);
    return id ? `https://www.youtube-nocookie.com/embed/${id}` : null;
  }
  if (host === "youtu.be") {
    const id = idOk(u.pathname.slice(1));
    return id ? `https://www.youtube-nocookie.com/embed/${id}` : null;
  }
  if (host === "vimeo.com") {
    const id = u.pathname.match(/^\/(\d{6,12})$/)?.[1];
    return id ? `https://player.vimeo.com/video/${id}` : null;
  }
  return null;
}

export type QuestionForGrading = { id: string; correctIndex: number; optionCount: number };

/** Server-side grading: answers are option indexes keyed by question id; unanswered = wrong. */
export function gradeQuiz(questions: readonly QuestionForGrading[], answers: Record<string, unknown>, passPct: number) {
  let score = 0;
  const detail = questions.map((q) => {
    const raw = answers[q.id];
    const chosen = typeof raw === "number" && Number.isInteger(raw) && raw >= 0 && raw < q.optionCount ? raw : null;
    const correct = chosen === q.correctIndex;
    if (correct) score += 1;
    return { questionId: q.id, chosen, correct };
  });
  const total = questions.length;
  const pct = total === 0 ? 0 : Math.round((score / total) * 100);
  return { score, total, pct, passed: total > 0 && pct >= passPct, detail };
}

export function courseProgress(totalLessons: number, completedLessons: number) {
  const pct = totalLessons === 0 ? 0 : Math.round((Math.min(completedLessons, totalLessons) / totalLessons) * 100);
  return { pct, completed: totalLessons > 0 && completedLessons >= totalLessons };
}

/** Stable, non-guessable certificate code for (member, course). */
export function certificateCode(memberId: string, courseId: string): string {
  const h = createHash("sha256").update(`pfc-cert:${memberId}:${courseId}`).digest("hex").toUpperCase();
  return `PFC-${h.slice(0, 4)}-${h.slice(4, 8)}-${h.slice(8, 12)}`;
}

/** Validates 2–6 non-empty, distinct options and a correct index inside them. */
export function validateQuestion(options: readonly string[], correctIndex: number): string | null {
  const cleaned = options.map((o) => o.trim());
  if (cleaned.length < 2 || cleaned.length > 6) return "Mỗi câu hỏi cần 2–6 đáp án.";
  if (cleaned.some((o) => !o)) return "Đáp án không được để trống.";
  if (new Set(cleaned.map((o) => o.toLowerCase())).size !== cleaned.length) return "Các đáp án phải khác nhau.";
  if (!Number.isInteger(correctIndex) || correctIndex < 0 || correctIndex >= cleaned.length) return "Chọn đáp án đúng.";
  return null;
}

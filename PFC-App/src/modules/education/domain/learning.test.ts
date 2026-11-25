import { describe, expect, it } from "vitest";
import { certificateCode, courseProgress, gradeQuiz, toEmbedUrl, validateQuestion } from "./learning";

describe("video embeds", () => {
  it("accepts YouTube / youtu.be / shorts / Vimeo over https", () => {
    expect(toEmbedUrl("https://www.youtube.com/watch?v=dQw4w9WgXcQ")).toBe("https://www.youtube-nocookie.com/embed/dQw4w9WgXcQ");
    expect(toEmbedUrl("https://youtu.be/dQw4w9WgXcQ")).toBe("https://www.youtube-nocookie.com/embed/dQw4w9WgXcQ");
    expect(toEmbedUrl("https://youtube.com/shorts/dQw4w9WgXcQ")).toBe("https://www.youtube-nocookie.com/embed/dQw4w9WgXcQ");
    expect(toEmbedUrl("https://vimeo.com/123456789")).toBe("https://player.vimeo.com/video/123456789");
  });
  it("rejects anything else", () => {
    expect(toEmbedUrl("http://youtube.com/watch?v=dQw4w9WgXcQ")).toBeNull();
    expect(toEmbedUrl("https://evil.example/embed/x")).toBeNull();
    expect(toEmbedUrl("javascript:alert(1)")).toBeNull();
    expect(toEmbedUrl("https://youtube.com/watch?v=<script>")).toBeNull();
  });
});

describe("quiz grading", () => {
  const qs = [
    { id: "a", correctIndex: 1, optionCount: 4 },
    { id: "b", correctIndex: 0, optionCount: 3 },
    { id: "c", correctIndex: 2, optionCount: 3 },
  ];
  it("scores and applies the pass mark", () => {
    const r = gradeQuiz(qs, { a: 1, b: 0, c: 0 }, 60);
    expect(r).toMatchObject({ score: 2, total: 3, pct: 67, passed: true });
    expect(gradeQuiz(qs, { a: 1, b: 0, c: 0 }, 70).passed).toBe(false);
  });
  it("treats invalid / missing answers as wrong (no client trust)", () => {
    const r = gradeQuiz(qs, { a: "1", b: 99, c: -1 }, 50);
    expect(r.score).toBe(0);
    expect(r.detail.every((d) => d.chosen === null)).toBe(true);
  });
  it("an empty quiz never passes", () => {
    expect(gradeQuiz([], {}, 1).passed).toBe(false);
  });
});

describe("progress, certificates, question validation", () => {
  it("computes progress", () => {
    expect(courseProgress(4, 1)).toEqual({ pct: 25, completed: false });
    expect(courseProgress(4, 4)).toEqual({ pct: 100, completed: true });
    expect(courseProgress(0, 0)).toEqual({ pct: 0, completed: false });
  });
  it("certificate codes are stable and unique per member/course", () => {
    expect(certificateCode("m1", "c1")).toBe(certificateCode("m1", "c1"));
    expect(certificateCode("m1", "c1")).not.toBe(certificateCode("m2", "c1"));
    expect(certificateCode("m1", "c1")).toMatch(/^PFC-[0-9A-F]{4}-[0-9A-F]{4}-[0-9A-F]{4}$/);
  });
  it("validates questions", () => {
    expect(validateQuestion(["A", "B"], 1)).toBeNull();
    expect(validateQuestion(["A"], 0)).toMatch(/2–6/);
    expect(validateQuestion(["A", "a"], 0)).toMatch(/khác nhau/);
    expect(validateQuestion(["A", "B"], 2)).toMatch(/đáp án đúng/);
  });
});

/** Learning badges (mockup 140): achievements computed from the member's own progress. Pure. */
export type LearningStats = { enrolled: number; completed: number; minutes: number; quizzesPassed: number };
export type Badge = { key: string; label: string; description: string; earned: boolean; progress: number };

const DEFS: { key: string; label: string; description: string; metric: keyof LearningStats; target: number }[] = [
  { key: "first_course", label: "Khởi đầu", description: "Hoàn thành khóa học đầu tiên", metric: "completed", target: 1 },
  { key: "five_courses", label: "Chăm chỉ", description: "Hoàn thành 5 khóa học", metric: "completed", target: 5 },
  { key: "first_quiz", label: "Vượt ải", description: "Đạt bài kiểm tra đầu tiên", metric: "quizzesPassed", target: 1 },
  { key: "ten_quizzes", label: "Thành thạo", description: "Đạt 10 bài kiểm tra", metric: "quizzesPassed", target: 10 },
  { key: "hundred_min", label: "100 phút", description: "Học tổng cộng 100 phút", metric: "minutes", target: 100 },
  { key: "thousand_min", label: "1.000 phút", description: "Học tổng cộng 1.000 phút", metric: "minutes", target: 1000 },
];

export function badgesFor(s: LearningStats): Badge[] {
  return DEFS.map((d) => ({ key: d.key, label: d.label, description: d.description, earned: s[d.metric] >= d.target, progress: Math.min(1, s[d.metric] / d.target) }));
}

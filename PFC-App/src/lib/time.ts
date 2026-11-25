/** "vừa xong / 5 phút trước / 2 giờ trước / 3 ngày trước / 12/09/2026" (Vietnamese relative time). */
export function timeAgo(iso: string, nowMs = Date.now()): string {
  const s = Math.max(0, (nowMs - Date.parse(iso)) / 1000);
  if (s < 60) return "vừa xong";
  if (s < 3600) return `${Math.floor(s / 60)} phút trước`;
  if (s < 86400) return `${Math.floor(s / 3600)} giờ trước`;
  if (s < 7 * 86400) return `${Math.floor(s / 86400)} ngày trước`;
  return new Date(iso).toLocaleDateString("vi-VN", { timeZone: "Asia/Ho_Chi_Minh" });
}

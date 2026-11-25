/** UI filter buckets for /notifications (derived from type + payload). */

export type NotifyScope = "club" | "team" | "personal";

export function resolveNotifyScope(
  type: string,
  payload?: Record<string, unknown> | null,
): NotifyScope {
  const fromPayload = payload?.scope;
  if (fromPayload === "club" || fromPayload === "team" || fromPayload === "personal") {
    return fromPayload;
  }
  if (
    type.startsWith("task.") ||
    type.includes("ticket") ||
    type.includes("assign")
  ) {
    return "personal";
  }
  if (
    type.includes("team") ||
    type.includes("ban") ||
    payload?.teamId != null
  ) {
    return "team";
  }
  return "club";
}

export function notifyIcon(type: string): string {
  if (type.startsWith("task.")) return "⚡";
  if (type.startsWith("activity.") || type.includes("event")) return "🗓️";
  if (type.startsWith("document.")) return "📎";
  if (type.startsWith("membership.")) return "📣";
  return "📣";
}

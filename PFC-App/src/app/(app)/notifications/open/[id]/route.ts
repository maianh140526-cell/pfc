import { NextResponse, type NextRequest } from "next/server";
import { currentMember } from "@/platform/auth/session";
import { one } from "@/platform/db/client";
import { markRead } from "@/platform/notifications/service";

export const dynamic = "force-dynamic";

/** Opening a notification: mark it read (own notifications only), then go to its page. */
export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const me = await currentMember();
  if (!me) return NextResponse.redirect(new URL("/login?next=/notifications", req.url));
  const n = await one<{ href: string | null }>("SELECT href FROM notifications WHERE id = ? AND member_id = ?", [id, me.id]);
  if (n) await markRead(me.id, id);
  const href = n?.href && n.href.startsWith("/") && !n.href.startsWith("//") ? n.href : "/notifications";
  return NextResponse.redirect(new URL(href, req.url));
}

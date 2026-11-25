import { NextResponse, type NextRequest } from "next/server";
import { currentMember, toActor } from "@/platform/auth/session";
import { getMessages } from "@/modules/community/server/messages";
import { ActionError } from "@/platform/errors";

export const dynamic = "force-dynamic";

/** Chat polling (no websockets): messages after ?after=ISO. Participants only. */
export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const me = await currentMember();
  if (!me) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const { id } = await params;
  const after = req.nextUrl.searchParams.get("after") ?? undefined;
  try {
    const r = await getMessages(toActor(me), id, after && /^\d{4}-\d{2}-\d{2}T/.test(after) ? after : undefined);
    return NextResponse.json(r, { headers: { "cache-control": "no-store" } });
  } catch (err) {
    if (err instanceof ActionError) return NextResponse.json({ error: err.message }, { status: 404 });
    throw err;
  }
}

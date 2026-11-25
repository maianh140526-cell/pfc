import { NextResponse } from "next/server";
import { exportMyData } from "@/platform/account/service";
import { currentMember, toActor } from "@/platform/auth/session";
import { ActionError } from "@/platform/errors";

export const dynamic = "force-dynamic";

/** Mockup 275 "Tải xuống dữ liệu": JSON file with the signed-in member's own data only. */
export async function GET() {
  const me = await currentMember();
  if (!me) return NextResponse.json({ error: "Phiên đăng nhập đã hết hạn." }, { status: 401 });
  try {
    const data = await exportMyData(toActor(me));
    return new NextResponse(JSON.stringify(data, null, 2), {
      headers: {
        "content-type": "application/json; charset=utf-8",
        "content-disposition": `attachment; filename="pfc-du-lieu-ca-nhan-${new Date().toISOString().slice(0, 10)}.json"`,
        "cache-control": "no-store",
      },
    });
  } catch (err) {
    if (err instanceof ActionError) return NextResponse.json({ error: err.message }, { status: err.code === "rate_limited" ? 429 : 400 });
    throw err;
  }
}

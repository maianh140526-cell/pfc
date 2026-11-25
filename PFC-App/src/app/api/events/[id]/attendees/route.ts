import { NextResponse } from "next/server";
import { currentMember, toActor } from "@/platform/auth/session";
import { ActionError } from "@/platform/errors";
import { attendees } from "@/modules/events/server/service";

export const dynamic = "force-dynamic";

/** EVT-A03 Attendee list as CSV (organizer / Ban Sự kiện only). Cells are escaped against formula injection. */
export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const me = await currentMember();
  if (!me) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const { id } = await params;
  try {
    const list = await attendees(toActor(me), id);
    const cell = (v: string | number | null) => {
      let s = v === null ? "" : String(v);
      if (/^[=+\-@\t\r]/.test(s)) s = `'${s}`;
      return `"${s.replace(/"/g, '""')}"`;
    };
    const rows = [
      ["Họ tên", "Email", "Điện thoại", "Loại vé", "Giá", "Đã thanh toán", "Trạng thái", "Check-in", "Đăng ký lúc"],
      ...list.map((a) => [a.name, a.email, a.phone, a.ticketName, a.price, a.paid ? "Có" : "Chưa", a.status, a.checkedInAt ?? "", a.createdAt]),
    ];
    const csv = "﻿" + rows.map((r) => r.map(cell).join(",")).join("\r\n");
    return new NextResponse(csv, {
      headers: { "content-type": "text/csv; charset=utf-8", "content-disposition": `attachment; filename="attendees-${id.slice(0, 8)}.csv"`, "cache-control": "no-store" },
    });
  } catch (err) {
    if (err instanceof ActionError) return NextResponse.json({ error: err.message }, { status: 403 });
    throw err;
  }
}

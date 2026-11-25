import { NextResponse } from "next/server";
import { currentMember } from "@/platform/auth/session";
import { audit } from "@/platform/audit";
import { toCsv } from "@/modules/finance/domain/csv";
import { isMonthKey, periodRange, todayLocal, type PeriodKind } from "@/modules/finance/domain/dates";
import { listTransactions } from "@/modules/finance/server/queries";

/** FIN-20 export: owner-only CSV of the selected period (SRS Q13). */
export async function GET(req: Request) {
  const me = await currentMember();
  if (!me) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const url = new URL(req.url);
  const kindParam = url.searchParams.get("period");
  const kind: PeriodKind | "all" =
    kindParam === "quarter" || kindParam === "year" || kindParam === "all" ? kindParam : "month";
  const monthParam = url.searchParams.get("month");
  const month = isMonthKey(monthParam) ? monthParam : todayLocal().slice(0, 7);
  const range = kind === "all" ? {} : periodRange(kind, month);
  const txs = await listTransactions(me.id, { ...range, limit: 5000 });
  const csv = toCsv(
    [...txs].reverse().map((t) => ({
      occurredAt: t.occurredAt,
      type: t.type,
      amount: t.amount,
      category: t.categoryName,
      note: t.note,
    })),
  );
  await audit(me.id, "finance.export_csv", `period:${kind}:${month}`, "success");
  const name = kind === "all" ? "pfc-giao-dich-tat-ca.csv" : `pfc-giao-dich-${kind}-${month}.csv`;
  return new NextResponse(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${name}"`,
      "Cache-Control": "private, no-store",
    },
  });
}

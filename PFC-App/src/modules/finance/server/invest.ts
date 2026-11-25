import "server-only";
import { randomUUID } from "node:crypto";
import { z } from "zod";
import { all, one, run } from "@/platform/db/client";
import { ActionError } from "@/platform/errors";
import { MAX_AMOUNT_VND } from "@/lib/money";
import { HOLDING_KINDS, holdingValue, portfolio, type HoldingKind } from "../domain/invest";

/** Investment tracker (FIN invest, mockup 112). Owner-only: every query is scoped by member_id (BR-009). */
export type Holding = { id: string; name: string; symbol: string; kind: HoldingKind; quantity: number; avgCost: number; currentPrice: number; priceUpdatedAt: string; note: string; cost: number; value: number; gain: number; gainPct: number | null };

type Row = { id: string; name: string; symbol: string; kind: HoldingKind; quantity: number; avg_cost: number; current_price: number; price_updated_at: string; note: string };
const toHolding = (r: Row): Holding => {
  const h = { kind: r.kind, quantity: Number(r.quantity), avgCost: Number(r.avg_cost), currentPrice: Number(r.current_price) };
  return { id: r.id, name: r.name, symbol: r.symbol, ...h, priceUpdatedAt: r.price_updated_at, note: r.note, ...holdingValue(h) };
};

export async function listHoldings(memberId: string): Promise<{ holdings: Holding[]; summary: ReturnType<typeof portfolio> }> {
  const holdings = (await all<Row>("SELECT * FROM fin_holdings WHERE member_id = ? ORDER BY kind, name", [memberId])).map(toHolding);
  return { holdings, summary: portfolio(holdings) };
}

export async function getHolding(memberId: string, id: string): Promise<Holding | null> {
  const r = await one<Row>("SELECT * FROM fin_holdings WHERE member_id = ? AND id = ?", [memberId, id]);
  return r ? toHolding(r) : null;
}

const money = z.coerce.number().int("Giá phải là số nguyên (đồng).").min(0).max(MAX_AMOUNT_VND);
const schema = z.object({
  name: z.string().trim().min(1, "Nhập tên tài sản.").max(80),
  symbol: z.string().trim().toUpperCase().max(20).default(""),
  kind: z.enum(Object.keys(HOLDING_KINDS) as [HoldingKind, ...HoldingKind[]]),
  quantity: z.coerce.number().positive("Số lượng phải lớn hơn 0.").max(1e12),
  avgCost: money,
  currentPrice: money,
  note: z.string().trim().max(200).default(""),
});

export async function saveHolding(memberId: string, id: string | null, input: unknown): Promise<string> {
  const d = schema.parse(input);
  if (Math.round(d.quantity * Math.max(d.avgCost, d.currentPrice)) > MAX_AMOUNT_VND) throw new ActionError("Giá trị quá lớn.");
  const t = new Date().toISOString();
  if (id) {
    const old = await getHolding(memberId, id);
    if (!old) throw new ActionError("Không tìm thấy tài sản.");
    await run(
      "UPDATE fin_holdings SET name = ?, symbol = ?, kind = ?, quantity = ?, avg_cost = ?, current_price = ?, price_updated_at = ?, note = ?, updated_at = ? WHERE id = ? AND member_id = ?",
      [d.name, d.symbol, d.kind, d.quantity, d.avgCost, d.currentPrice, old.currentPrice !== d.currentPrice ? t : old.priceUpdatedAt, d.note, t, id, memberId],
    );
    return id;
  }
  const nid = randomUUID();
  await run(
    "INSERT INTO fin_holdings (id, member_id, name, symbol, kind, quantity, avg_cost, current_price, price_updated_at, note, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
    [nid, memberId, d.name, d.symbol, d.kind, d.quantity, d.avgCost, d.currentPrice, t, d.note, t, t],
  );
  return nid;
}

export async function updatePrice(memberId: string, id: string, price: unknown): Promise<void> {
  const p = money.parse(price);
  const t = new Date().toISOString();
  const n = await run("UPDATE fin_holdings SET current_price = ?, price_updated_at = ?, updated_at = ? WHERE id = ? AND member_id = ?", [p, t, t, id, memberId]);
  if (!n) throw new ActionError("Không tìm thấy tài sản.");
}

export async function deleteHolding(memberId: string, id: string): Promise<void> {
  const n = await run("DELETE FROM fin_holdings WHERE id = ? AND member_id = ?", [id, memberId]);
  if (!n) throw new ActionError("Không tìm thấy tài sản.");
}

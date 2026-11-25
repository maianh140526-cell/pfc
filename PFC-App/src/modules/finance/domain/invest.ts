/**
 * Investment tracker (mockup 112). Pure. Prices are what the member enters — PFC has no market data feed,
 * so every figure is labelled "theo giá bạn cập nhật".
 */
export const HOLDING_KINDS = {
  stock: "Cổ phiếu",
  fund: "Chứng chỉ quỹ",
  bond: "Trái phiếu",
  gold: "Vàng",
  crypto: "Tiền mã hóa",
  deposit: "Tiền gửi",
  other: "Khác",
} as const;
export type HoldingKind = keyof typeof HOLDING_KINDS;

export type HoldingLite = { kind: HoldingKind; quantity: number; avgCost: number; currentPrice: number };

export function holdingValue(h: HoldingLite) {
  const cost = Math.round(h.quantity * h.avgCost);
  const value = Math.round(h.quantity * h.currentPrice);
  const gain = value - cost;
  return { cost, value, gain, gainPct: cost > 0 ? (gain / cost) * 100 : null };
}

export function portfolio(hs: readonly HoldingLite[]) {
  let cost = 0;
  let value = 0;
  const byKind = new Map<HoldingKind, number>();
  for (const h of hs) {
    const v = holdingValue(h);
    cost += v.cost;
    value += v.value;
    byKind.set(h.kind, (byKind.get(h.kind) ?? 0) + v.value);
  }
  const allocation = [...byKind.entries()]
    .filter(([, v]) => v > 0)
    .sort((a, b) => b[1] - a[1])
    .map(([kind, v]) => ({ kind, value: v, share: value > 0 ? v / value : 0 }));
  return { cost, value, gain: value - cost, gainPct: cost > 0 ? ((value - cost) / cost) * 100 : null, allocation };
}

/** Days since the price was last updated (to nudge the member to refresh it). */
export const staleDays = (priceUpdatedAt: string, now = Date.now()) => Math.floor((now - Date.parse(priceUpdatedAt)) / 86_400_000);

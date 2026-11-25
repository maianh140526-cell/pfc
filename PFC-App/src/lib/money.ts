/** VND formatting / parsing for amount inputs. VND has no minor unit. */
const vnd = new Intl.NumberFormat("vi-VN", { maximumFractionDigits: 0 });

export const MAX_AMOUNT_VND = 999_999_999_999;

export function formatVnd(amount: number): string {
  return `${vnd.format(Math.round(amount))}₫`;
}

/** Digits-only grouping for an input field, e.g. "1200000" → "1.200.000". */
export function formatAmountInput(digits: string): string {
  if (!digits) return "";
  return vnd.format(Number(digits));
}

/** Keep only digits from user input (paste, IME, separators), capped to the max amount. */
export function sanitizeAmountDigits(raw: string): string {
  const digits = raw.replace(/\D+/g, "").replace(/^0+(?=\d)/, "");
  if (!digits) return "";
  return Number(digits) > MAX_AMOUNT_VND ? String(MAX_AMOUNT_VND) : digits;
}

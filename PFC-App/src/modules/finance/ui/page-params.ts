import { isMonthKey, todayLocal } from "../domain/dates";

/** Reads ?month=YYYY-MM, defaulting to the current Vietnam month. */
export function monthParam(raw: string | string[] | undefined): string {
  const v = Array.isArray(raw) ? raw[0] : raw;
  return isMonthKey(v) ? v : todayLocal().slice(0, 7);
}

export function firstParam(raw: string | string[] | undefined): string | undefined {
  return Array.isArray(raw) ? raw[0] : raw;
}

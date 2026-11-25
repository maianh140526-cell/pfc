import { describe, expect, it } from "vitest";
import { MAX_AMOUNT_VND, formatAmountInput, formatVnd, sanitizeAmountDigits } from "./money";

describe("money helpers", () => {
  it("formats VND with vi-VN grouping", () => {
    expect(formatVnd(12500000)).toBe("12.500.000₫");
    expect(formatAmountInput("65000")).toBe("65.000");
    expect(formatAmountInput("")).toBe("");
  });
  it("strips separators and leading zeros", () => {
    expect(sanitizeAmountDigits("1.200.000")).toBe("1200000");
    expect(sanitizeAmountDigits("00045")).toBe("45");
    expect(sanitizeAmountDigits("abc")).toBe("");
    expect(sanitizeAmountDigits("0")).toBe("0");
  });
  it("caps at the maximum amount", () => {
    expect(sanitizeAmountDigits("99999999999999")).toBe(String(MAX_AMOUNT_VND));
  });
});

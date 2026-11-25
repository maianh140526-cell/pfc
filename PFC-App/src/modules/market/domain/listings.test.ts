import { describe, expect, it } from "vitest";
import { DEFAULT_MARKET_LIMITS as cfg, deliveryFor, listingRiskCheck, normalizeTags } from "./listings";

describe("risk-based verification", () => {
  it("basic sellers sell low-risk items under the caps; high-risk types need verification", () => {
    expect(listingRiskCheck("basic", { kind: "product", price: 85_000 }, 0, cfg, true)).toBeNull();
    expect(listingRiskCheck("basic", { kind: "product", price: 3_000_000 }, 0, cfg, true)).toMatch(/2\.000\.000/);
    expect(listingRiskCheck("basic", { kind: "service", price: 100_000 }, 0, cfg, true)).toMatch(/xác minh/);
    expect(listingRiskCheck("basic", { kind: "ticket", price: 0 }, 0, cfg, true)).toMatch(/Vé sự kiện/);
    expect(listingRiskCheck("basic", { kind: "digital", price: 50_000 }, 10, cfg, true)).toMatch(/tối đa 10/);
    expect(listingRiskCheck("basic", { kind: "digital", price: 50_000 }, 10, cfg, false)).toBeNull();
    expect(listingRiskCheck("verified", { kind: "course", price: 5_000_000 }, 99, cfg, true)).toBeNull();
  });
  it("normalizes tags and delivery", () => {
    expect(normalizeTags(["#Sách", "sách", " Tài  chính ", "a", "x".repeat(30)])).toEqual(["sách", "tài chính"]);
    expect(normalizeTags(Array.from({ length: 12 }, (_, i) => `tag${i}`))).toHaveLength(8);
    expect(deliveryFor("ticket", "ship")).toBe("online");
    expect(deliveryFor("product", "pickup")).toBe("pickup");
  });
});

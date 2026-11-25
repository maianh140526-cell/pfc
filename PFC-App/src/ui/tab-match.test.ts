import { describe, expect, it } from "vitest";
import { isTabActive } from "./tab-match";

describe("isTabActive", () => {
  it("matches the tab root and its children only", () => {
    expect(isTabActive("/finance", "/finance")).toBe(true);
    expect(isTabActive("/finance/add", "/finance")).toBe(true);
    expect(isTabActive("/financeX", "/finance")).toBe(false);
    expect(isTabActive("/more/appearance", "/home")).toBe(false);
  });
});

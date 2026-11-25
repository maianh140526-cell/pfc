import { describe, expect, it } from "vitest";
import { applyWorkflow, canEditContent, canViewContent } from "./workflow";

const author = { isAuthor: true, canApprove: false };
const approver = { isAuthor: false, canApprove: true };
const authorApprover = { isAuthor: true, canApprove: true };
const stranger = { isAuthor: false, canApprove: false };

describe("content workflow", () => {
  it("author submits a draft for review", () => {
    expect(applyWorkflow("submit", "draft", author)).toEqual({ ok: true, to: "submitted" });
    expect(applyWorkflow("submit", "rejected", author)).toEqual({ ok: true, to: "submitted" });
    expect(applyWorkflow("submit", "published", author).ok).toBe(false);
    expect(applyWorkflow("submit", "draft", stranger).ok).toBe(false);
  });
  it("an approver who authors publishes directly", () => {
    expect(applyWorkflow("submit", "draft", authorApprover)).toEqual({ ok: true, to: "published" });
  });
  it("only approvers approve / reject, and rejection needs a reason", () => {
    expect(applyWorkflow("approve", "submitted", author).ok).toBe(false);
    expect(applyWorkflow("approve", "submitted", approver)).toEqual({ ok: true, to: "published" });
    expect(applyWorkflow("approve", "draft", approver).ok).toBe(false);
    expect(applyWorkflow("reject", "submitted", approver).ok).toBe(false);
    expect(applyWorkflow("reject", "submitted", approver, "Thiếu nguồn")).toEqual({ ok: true, to: "rejected" });
  });
  it("archive / restore", () => {
    expect(applyWorkflow("archive", "published", author)).toEqual({ ok: true, to: "archived" });
    expect(applyWorkflow("archive", "published", stranger).ok).toBe(false);
    expect(applyWorkflow("restore", "archived", author).ok).toBe(false);
    expect(applyWorkflow("restore", "archived", approver)).toEqual({ ok: true, to: "published" });
  });
  it("edit and visibility rules", () => {
    expect(canEditContent("draft", author)).toBe(true);
    expect(canEditContent("submitted", author)).toBe(false);
    expect(canEditContent("published", author)).toBe(false);
    expect(canEditContent("published", approver)).toBe(true);
    expect(canViewContent("submitted", stranger)).toBe(false);
    expect(canViewContent("published", stranger)).toBe(true);
    expect(canViewContent("draft", author)).toBe(true);
  });
});

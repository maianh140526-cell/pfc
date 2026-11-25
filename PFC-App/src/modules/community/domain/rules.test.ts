import { describe, expect, it } from "vitest";
import { canReadPost, canRemoveFromGroup, canStartConversation, extractTags, groupCaps, pairKey, validatePoll } from "./rules";

describe("community rules", () => {
  it("extracts Vietnamese hashtags, unique and lower-cased", () => {
    expect(extractTags("Mẹo hay #TietKiem #TàiChínhCáNhân và #tietkiem, email a#b, #x")).toEqual(["tietkiem", "tàichínhcánhân"]);
    expect(extractTags("không có tag")).toEqual([]);
  });
  it("validates polls", () => {
    expect(validatePoll(undefined)).toEqual([]);
    expect(validatePoll(["", " "])).toEqual([]);
    expect(validatePoll(["Có"])).toMatch(/ít nhất 2/);
    expect(validatePoll(["Có", "có"])).toMatch(/trùng/);
    expect(validatePoll(["A", "B", "C", "D", "E", "F", "G"])).toMatch(/tối đa 6/);
    expect(validatePoll([" Có ", "Không"])).toEqual(["Có", "Không"]);
  });
  it("group roles: members post, moderators admit + hide, only the owner removes", () => {
    expect(groupCaps(null, "private", false)).toMatchObject({ viewContent: false, post: false, moderate: false });
    expect(groupCaps(null, "public", false)).toMatchObject({ viewContent: true, post: false });
    expect(groupCaps("member", "private", false)).toMatchObject({ viewContent: true, post: true, moderate: false, removeMembers: false });
    expect(groupCaps("moderator", "public", false)).toMatchObject({ moderate: true, admit: true, removeMembers: false, changeRoles: false });
    expect(groupCaps(null, "private", true)).toMatchObject({ viewContent: true, moderate: true, admit: false });
    expect(canRemoveFromGroup("owner", "moderator")).toBe(true);
    expect(canRemoveFromGroup("moderator", "member")).toBe(false);
    expect(canRemoveFromGroup("member", "member")).toBe(false);
    expect(canRemoveFromGroup("owner", "owner")).toBe(false);
  });
  it("post visibility", () => {
    const p = { status: "published" as const, authorId: "a", groupVisible: false };
    expect(canReadPost(p, "x", false)).toBe(false);
    expect(canReadPost({ ...p, groupVisible: true }, null, false)).toBe(true);
    expect(canReadPost({ ...p, status: "hidden", groupVisible: true }, "x", false)).toBe(false);
    expect(canReadPost({ ...p, status: "hidden" }, "a", false)).toBe(true);
    expect(canReadPost({ ...p, status: "hidden" }, "m", true)).toBe(true);
    expect(canReadPost({ ...p, status: "deleted" }, "a", true)).toBe(false);
  });
  it("message policy and blocks", () => {
    expect(canStartConversation("members", false, false, false)).toBe(true);
    expect(canStartConversation("following", false, false, false)).toBe(false);
    expect(canStartConversation("following", true, false, false)).toBe(true);
    expect(canStartConversation("none", true, false, false)).toBe(false);
    expect(canStartConversation("members", true, true, false)).toBe(false);
    expect(canStartConversation("members", true, false, true)).toBe(false);
    expect(pairKey("b", "a")).toBe(pairKey("a", "b"));
  });
});

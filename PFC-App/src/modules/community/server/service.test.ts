import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { cleanupTempDbs, useTempDb } from "../../../../test/db";

useTempDb();
const { makeMember } = await import("../../../../test/members");
const com = await import("./service");
const dm = await import("./messages");
const { listNotifications } = await import("@/platform/notifications/service");
const { run } = await import("@/platform/db/client");
afterAll(cleanupTempDbs);

type M = Awaited<ReturnType<typeof makeMember>>;
let owner: M, mod: M, mem: M, out: M, tt: M;

beforeAll(async () => {
  owner = await makeMember("thanh_vien", null, "Chủ nhóm");
  mod = await makeMember("thanh_vien", null, "Điều hành");
  mem = await makeMember("thanh_vien", null, "Thành viên");
  out = await makeMember("thanh_vien", null, "Người ngoài");
  tt = await makeMember("truong_ban", "truyen_thong", "TB Truyền thông");
});

describe("groups", () => {
  let gid = "";
  it("private groups need approval; moderators admit but cannot kick; only the owner removes", async () => {
    gid = await com.createGroup(owner, { name: "Nhóm Đầu tư", visibility: "private", topic: "invest" });
    expect(await com.joinGroup(mod, gid)).toBe("requested");
    expect((await listNotifications(owner.id))[0].title).toMatch(/yêu cầu tham gia nhóm/);
    await expect(com.decideJoin(mem, gid, mod.id, true)).rejects.toThrow(/Chỉ chủ nhóm/);
    await com.decideJoin(owner, gid, mod.id, true);
    await com.setGroupRole(owner, gid, mod.id, "moderator");
    await com.joinGroup(mem, gid);
    await com.decideJoin(mod, gid, mem.id, true); // moderator admits
    await expect(com.removeFromGroup(mod, gid, mem.id)).rejects.toThrow(/Chỉ chủ nhóm/);
    await expect(com.removeFromGroup(mem, gid, mod.id)).rejects.toThrow(/Chỉ chủ nhóm/);
    await expect(com.removeFromGroup(owner, gid, owner.id)).rejects.toThrow(/chủ nhóm/);
    await expect(com.leaveGroup(owner, gid)).rejects.toThrow(/không thể rời/);
    expect((await com.getGroup(out, gid))?.caps.viewContent).toBe(false);
  });
  it("private group posts are invisible outside the group", async () => {
    await expect(com.createPost(out, { groupId: gid, body: "Xin chào cả nhóm" })).rejects.toThrow(/tham gia nhóm/);
    const pid = await com.createPost(mem, { groupId: gid, body: "Bài trong nhóm riêng #dautu" });
    expect(await com.getPost(out, pid)).toBeNull();
    expect((await com.feed(out)).some((p) => p.id === pid)).toBe(false);
    expect((await com.feed(mem, { groupId: gid }))[0].id).toBe(pid);
  });
  it("removed members are banned from re-joining", async () => {
    await com.removeFromGroup(owner, gid, mem.id);
    await expect(com.joinGroup(mem, gid)).rejects.toThrow(/không thể tham gia/);
  });
});

describe("posts, comments, polls", () => {
  let pid = "";
  it("creates a public post with tags and a poll; strangers can like, comment and vote", async () => {
    await expect(com.createPost(mem, { body: "ok", poll: ["A"] })).rejects.toThrow();
    pid = await com.createPost(mem, { title: "Quỹ khẩn cấp", body: "Bạn để quỹ khẩn cấp mấy tháng? #TietKiem", topic: "finance", poll: ["3 tháng", "6 tháng"] });
    const p = await com.getPost(out, pid);
    expect(p?.tags).toEqual(["tietkiem"]);
    expect(p?.poll?.options).toHaveLength(2);
    expect(await com.toggleLike(out, pid)).toBe(true);
    await com.vote(out, pid, p!.poll!.options[1].id);
    await com.vote(out, pid, p!.poll!.options[0].id); // change vote
    const after = await com.getPost(out, pid);
    expect(after?.poll?.total).toBe(1);
    expect(after?.poll?.myVote).toBe(p!.poll!.options[0].id);
    await com.addComment(out, pid, "6 tháng là an toàn.");
    expect((await listNotifications(mem.id))[0].title).toMatch(/bình luận/);
    expect((await com.feed(out, { tag: "tietkiem" })).map((x) => x.id)).toContain(pid);
  });
  it("only authors edit/delete; members cannot hide others' posts; moderators hide with a reason", async () => {
    await expect(com.updatePost(out, pid, { body: "sửa bài người khác" })).rejects.toThrow(/của mình/);
    await expect(com.deletePost(out, pid)).rejects.toThrow(/của mình/);
    await expect(com.setPostHidden(out, pid, true, "spam")).rejects.toThrow(/quyền/);
    await expect(com.setPostHidden(tt, pid, true)).rejects.toThrow(/lý do/);
    await com.setPostHidden(tt, pid, true, "Quảng cáo");
    expect(await com.getPost(out, pid)).toBeNull();
    expect((await com.getPost(mem, pid))?.hiddenReason).toBe("Quảng cáo"); // author still sees why
    await com.setPostHidden(tt, pid, false);
  });
  it("comments can be turned off", async () => {
    const id = await com.createPost(mem, { body: "Không nhận bình luận", allowComments: false });
    await expect(com.addComment(out, id, "hi")).rejects.toThrow(/tắt bình luận/);
  });
});

describe("follows, blocks, reports, messages", () => {
  it("follow notifies; block hides posts and stops messages", async () => {
    expect(await com.toggleFollow(out, mem.id)).toBe(true);
    expect((await com.socialStats(out, mem.id)).followers).toBe(1);
    const cid = await dm.startConversation(out, mem.id);
    await dm.sendMessage(out, cid, "Chào bạn!");
    await dm.sendMessage(out, cid, "Bạn rảnh không?");
    const notes = (await listNotifications(mem.id)).filter((n) => n.title.startsWith("Tin nhắn mới"));
    expect(notes).toHaveLength(1); // one per unread burst
    expect(await dm.unreadMessages(mem)).toBe(2);
    const view = await dm.getMessages(mem, cid);
    expect(view.messages.map((m) => m.body)).toEqual(["Chào bạn!", "Bạn rảnh không?"]);
    expect(await dm.unreadMessages(mem)).toBe(0);
    await expect(dm.getMessages(owner, cid)).rejects.toThrow(/Không tìm thấy/);
    await com.toggleBlock(mem, out.id);
    await expect(dm.sendMessage(out, cid, "còn đó không?")).rejects.toThrow(/Không thể gửi/);
    expect((await com.feed(mem)).some((p) => p.authorId === out.id)).toBe(false);
    expect((await com.socialStats(out, mem.id)).isFollowing).toBe(false);
  });
  it("respects the recipient's message privacy", async () => {
    await run("UPDATE members SET privacy = ? WHERE id = ?", [JSON.stringify({ profileVisibility: "members", findByEmail: true, messages: "following" }), owner.id]);
    await expect(dm.startConversation(tt, owner.id)).rejects.toThrow(/chỉ nhận tin nhắn/);
    await com.toggleFollow(owner, tt.id);
    expect(await dm.startConversation(tt, owner.id)).toBeTruthy();
  });
  it("reports go to moderators; deciding closes all reports on the target", async () => {
    const pid = await com.createPost(owner, { body: "Mua ngay khóa học làm giàu nhanh!!!" });
    await com.report(mem, { targetType: "post", targetId: pid, reason: "scam" });
    await com.report(out, { targetType: "post", targetId: pid, reason: "spam" });
    await expect(com.reportQueue(mem)).rejects.toThrow(/quyền/);
    const q = await com.reportQueue(tt);
    expect(q.find((r) => r.targetId === pid)?.count).toBe(2);
    await com.decideReport(tt, q.find((r) => r.targetId === pid)!.id, "hide");
    expect((await com.reportQueue(tt)).some((r) => r.targetId === pid)).toBe(false);
    expect(await com.getPost(mem, pid)).toBeNull();
  });
});

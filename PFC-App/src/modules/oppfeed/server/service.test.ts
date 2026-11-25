import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { cleanupTempDbs, useTempDb } from "../../../../test/db";

useTempDb();
const { makeMember } = await import("../../../../test/members");
const feed = await import("./service");

type M = Awaited<ReturnType<typeof makeMember>>;
let leader: M, member: M, other: M;

beforeAll(async () => {
  leader = await makeMember("truong_ban", "truyen_thong", "Trưởng ban TT");
  other = await makeMember("ban_dieu_hanh", null, "Ban điều hành");
  member = await makeMember("thanh_vien", null, "Thành viên");
});
afterAll(cleanupTempDbs);

const POST = { type: "scholarship", title: "Học bổng Khuyến khích học tập", summary: "Dành cho sinh viên có GPA từ 3.2, nộp hồ sơ online.", organization: "Ban Học bổng PFC", location: "Hà Nội", url: "https://example.com/dang-ky", deadlineAt: "2099-12-31" };

describe("posts by leaders", () => {
  it("members cannot post; leaders can, and the post shows as open with its deadline", async () => {
    await expect(feed.createPost(member, POST)).rejects.toThrow(/Ban điều hành và Trưởng ban/);
    const id = await feed.createPost(leader, POST);
    const o = await feed.getExternal(id);
    expect(o).toMatchObject({ source: "pfc", type: "scholarship", organization: "Ban Học bổng PFC", authorName: "Trưởng ban TT" });
    expect(o?.deadlineAt).toBe("2099-12-31T16:59:59.000Z");
    expect(o?.state.code).toBe("open");
    expect((await feed.listExternal({ type: "scholarship" })).map((x) => x.id)).toContain(id);
  });

  it("validates input: https link, deadline format, title length", async () => {
    await expect(feed.createPost(leader, { ...POST, url: "http://x.com" })).rejects.toThrow(/https/);
    await expect(feed.createPost(leader, { ...POST, url: "javascript:alert(1)" })).rejects.toThrow(/https/);
    await expect(feed.createPost(leader, { ...POST, deadlineAt: "31/12/2099" })).rejects.toThrow();
    await expect(feed.createPost(leader, { ...POST, title: "ab" })).rejects.toThrow();
  });

  it("only the author (or an admin) edits, closes or deletes; closing hides it from the open list", async () => {
    const id = await feed.createPost(leader, { ...POST, title: "Cuộc thi Ý tưởng khởi nghiệp", type: "competition" });
    await expect(feed.setPostState(member, id, "closed")).rejects.toThrow();
    await feed.updatePost(leader, id, { ...POST, title: "Cuộc thi Ý tưởng khởi nghiệp 2026", type: "competition" });
    await feed.setPostState(leader, id, "closed");
    expect((await feed.listExternal()).map((x) => x.id)).not.toContain(id);
    expect((await feed.listExternal({ includeClosed: true })).find((x) => x.id === id)?.state.code).toBe("closed");
    await feed.setPostState(other, id, "open"); // Ban điều hành may reopen anyone's post
    expect((await feed.getExternal(id))?.rawState).toBe("open");
    await feed.deletePost(leader, id);
    expect(await feed.getExternal(id)).toBeNull();
  });

  it("a post past its deadline no longer appears in the open list", async () => {
    const id = await feed.createPost(leader, { ...POST, title: "Tuyển CTV sự kiện", type: "job", deadlineAt: "2099-01-01" });
    const { run } = await import("@/platform/db/client");
    await run("UPDATE ext_opportunities SET deadline_at = '2020-01-01T00:00:00.000Z' WHERE id = ?", [id]);
    expect((await feed.listExternal({ type: "job" })).map((x) => x.id)).not.toContain(id);
    expect((await feed.getExternal(id))?.state.label).toBe("Hết hạn");
  });
});

describe("outside sources", () => {
  it("stores what the feeds return, updates on the next refresh, and tolerates a failing source", async () => {
    const remote = [{ legal: "x" }, { id: "77", epoch: Math.floor(Date.now() / 1000), company: "Acme", position: "Junior Analyst", url: "https://remoteok.com/remote-jobs/77", description: "<p>SQL</p>", location: "Worldwide", tags: [] }];
    vi.stubGlobal(
      "fetch",
      vi.fn(async (url: string) => {
        if (String(url).startsWith("https://remoteok.com/api")) return Object.defineProperty(new Response(JSON.stringify(remote)), "url", { value: "https://remoteok.com/api" });
        return new Response("nope", { status: 503 });
      }),
    );
    const first = await feed.refreshFeed();
    expect(first.find((s) => s.source === "remoteok")).toMatchObject({ ok: true, count: 1 });
    expect(first.find((s) => s.source === "wwr")?.ok).toBe(false);
    remote[1].position = "Senior Analyst";
    await feed.refreshFeed();
    const all = await feed.listExternal({ source: "remoteok" });
    expect(all).toHaveLength(1);
    expect(all[0]).toMatchObject({ title: "Senior Analyst", type: "job", sourceLabel: "Remote OK" });
    vi.unstubAllGlobals();
  });

  it("refreshes at most once per window", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => new Response("x", { status: 503 })));
    expect(await feed.refreshIfStale()).not.toBeNull();
    expect(await feed.refreshIfStale()).toBeNull();
    vi.unstubAllGlobals();
  });
});

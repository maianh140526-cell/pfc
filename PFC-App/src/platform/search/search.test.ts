import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { cleanupTempDbs, useTempDb } from "../../../test/db";

useTempDb();
process.env.OPP_API_ORIGIN = "http://127.0.0.1:9"; // unreachable: opportunities simply drop out
const { search, normaliseQuery } = await import("./service");
const { makeMember } = await import("../../../test/members");
const { run } = await import("@/platform/db/client");
afterAll(cleanupTempDbs);

type M = Awaited<ReturnType<typeof makeMember>>;
let a: M, b: M, hidden: M;
const t = new Date().toISOString();

beforeAll(async () => {
  a = await makeMember("thanh_vien", null, "Ngân Sách An");
  b = await makeMember("thanh_vien", null, "Bình");
  hidden = await makeMember("thanh_vien", null, "Ngân Sách Ẩn");
  await run("UPDATE members SET privacy = ? WHERE id = ?", [JSON.stringify({ profileVisibility: "private", findByEmail: true }), hidden.id]);
  await run("INSERT INTO edu_courses (id, author_id, title, summary, description, topic, level, status, created_at, updated_at, published_at) VALUES ('c1', ?, 'Lập ngân sách 50/30/20', 'Cơ bản', '', 'finance', 'basic', 'published', ?, ?, ?)", [a.id, t, t, t]);
  await run("INSERT INTO edu_courses (id, author_id, title, summary, description, topic, level, status, created_at, updated_at) VALUES ('c2', ?, 'Ngân sách nháp', '', '', 'finance', 'basic', 'draft', ?, ?)", [a.id, t, t]);
  await run("INSERT INTO fin_categories (id, member_id, name, icon, type, created_at) VALUES ('cat1', ?, 'Sách vở', 'book', 'expense', ?)", [a.id, t]);
  await run("INSERT INTO fin_transactions (id, member_id, type, amount, category_id, note, occurred_at, created_at, updated_at) VALUES ('t1', ?, 'expense', 50000, 'cat1', 'Mua sách ngân sách', ?, ?, ?)", [a.id, t, t, t]);
});

describe("global search", () => {
  it("normalises queries and ignores very short ones", async () => {
    expect(normaliseQuery("  ngân   sách  ")).toBe("ngân sách");
    expect((await search(a, "n")).groups).toEqual({});
  });
  it("finds only published content; private members and other people's money stay hidden", async () => {
    const r = await search(b, "ngân sách");
    expect(r.groups.course?.map((h) => h.id)).toEqual(["c1"]);
    expect(r.groups.member?.map((h) => h.title)).toEqual(["Ngân Sách An"]);
    expect(r.groups.transaction).toBeUndefined();
    expect(r.groups.opportunity).toBeUndefined();
    const mine = await search(a, "ngân sách", "transaction");
    expect(mine.groups.transaction?.[0]).toMatchObject({ id: "t1", amount: -50000 });
    expect((await search(hidden, "Ngân Sách Ẩn", "member")).groups.member?.[0]?.id).toBe(hidden.id); // you still find yourself
  });
  it("signed-out visitors see public content only", async () => {
    const r = await search(null, "ngân sách");
    expect(r.groups.course).toHaveLength(1);
    expect(r.groups.member).toBeUndefined();
    expect(r.groups.transaction).toBeUndefined();
  });
  it("treats LIKE wildcards literally", async () => {
    expect((await search(a, "%%", "course")).groups.course).toBeUndefined();
  });
});

describe("community in search", () => {
  it("finds public community posts and groups, never private-group posts", async () => {
    const com = await import("@/modules/community/server/service");
    const pub = await com.createPost(a, { body: "Kinh nghiệm lập ngân sách tháng đầu tiên" });
    const gid = await com.createGroup(a, { name: "Nhóm ngân sách kín", visibility: "private" });
    const priv = await com.createPost(a, { groupId: gid, body: "Ngân sách nội bộ của nhóm" });
    const r = await search(b, "ngân sách");
    expect(r.groups.post?.map((h) => h.id)).toContain(pub);
    expect(r.groups.post?.map((h) => h.id)).not.toContain(priv);
    expect(r.groups.group?.map((h) => h.id)).toContain(gid);
  });
});

import { describe, expect, it } from "vitest";
import { findDeadline, parseRemoteOk, parseUebArticle, parseWwrRss, safeHttpsUrl, stateOf, toPlainText, uebArticleId, uebOpportunityLinks } from "./feed";

describe("text and url safety", () => {
  it("strips markup and entities, never keeps scripts", () => {
    expect(toPlainText("<p>Xin &amp; chào <b>bạn</b></p><script>alert(1)</script>")).toBe("Xin & chào bạn");
    expect(toPlainText("&lt;img src=x onerror=alert(1)&gt;ok")).toBe("ok");
    expect(toPlainText("a ".repeat(400), 50).length).toBeLessThanOrEqual(51);
  });
  it("keeps https URLs only", () => {
    expect(safeHttpsUrl("https://a.com/x")).toBe("https://a.com/x");
    expect(safeHttpsUrl("http://a.com")).toBe("");
    expect(safeHttpsUrl("javascript:alert(1)")).toBe("");
    expect(safeHttpsUrl(5)).toBe("");
  });
});

describe("Remote OK", () => {
  const feed = [
    { legal: "terms" },
    { id: "9", epoch: 1795258805, company: "Acme", position: "Data Analyst", tags: ["sql", "excel"], location: "Worldwide", url: "https://remoteok.com/remote-jobs/9", description: "<p>Analyse <b>data</b></p>", company_logo: "https://remoteok.com/logo.png" },
    { id: "10", position: "No link" },
  ];
  it("skips the legal header and rows without a link, keeps the rest", () => {
    const [a, ...rest] = parseRemoteOk(feed);
    expect(rest).toHaveLength(0);
    expect(a).toMatchObject({ source: "remoteok", externalId: "9", type: "job", title: "Data Analyst", organization: "Acme", imageUrl: "https://remoteok.com/logo.png", summary: "Analyse data" });
    expect(a.location).toContain("sql");
  });
  it("tolerates garbage", () => {
    expect(parseRemoteOk(null)).toEqual([]);
    expect(parseRemoteOk({})).toEqual([]);
  });
});

describe("We Work Remotely", () => {
  const xml = `<rss><channel><item><title>Carrot: Manager, Product Design</title><region>Anywhere</region><type>Full-Time</type>
    <description>&lt;p&gt;Hello &lt;strong&gt;team&lt;/strong&gt;&lt;/p&gt;</description><pubDate>Sun, 22 Nov 2026 06:02:54 +0000</pubDate>
    <expires_at>Tue, 22 Dec 2026 06:02:54 +0000</expires_at><link>https://weworkremotely.com/remote-jobs/carrot-manager</link></item></channel></rss>`;
  it("splits company and title and reads the expiry", () => {
    expect(parseWwrRss(xml)[0]).toMatchObject({ source: "wwr", organization: "Carrot", title: "Manager, Product Design", summary: "Hello team", deadlineAt: "2026-12-22T06:02:54.000Z", externalId: "carrot-manager" });
  });
});

describe("UEB", () => {
  const list = `<a href="/Tin-Tuc/UEB/thong-bao-hoc-bong-khuyen-khich-hoc-tap/47001">x</a>
    <a href="Tin-Tuc/UEB/Lich-thi-hoc-ky/47002">y</a>
    <a href="/Tin-Tuc/UEB/cuoc-thi-khoi-nghiep-sinh-vien-2026/47003">z</a>
    <a href="https://evil.example/Tin-Tuc/UEB/hoc-bong-gia/47004">w</a>
    <a href="/Sinh-Vien-Hoc-Vien/UEB/thong-bao-hoc-bong-doanh-nghiep/1777/0/0/47005">v</a>`;
  it("picks opportunity articles on the UEB host only", () => {
    const links = uebOpportunityLinks(list);
    expect(links.map((l) => l.type)).toEqual(["scholarship", "competition", "scholarship"]);
    expect(uebArticleId(links[2].url)).toBe("47005");
    expect(links.every((l) => l.url.startsWith("https://ueb.edu.vn/"))).toBe(true);
  });
  it("reads title, image, summary and the application deadline from the article", () => {
    const html = `<head><meta property="og:title" content="Học bổng A &amp; B" /><meta property="og:description" content="Mô tả ngắn" />
      <meta property="og:image" content="https://admin.cms.ueb.edu.vn/x.png" /></head><body><p>Hạn nộp hồ sơ: 30/12/2026.</p></body>`;
    const it = parseUebArticle(html, "https://ueb.edu.vn/Tin-Tuc/UEB/hoc-bong-a/47001", "scholarship")!;
    expect(it).toMatchObject({ source: "ueb", externalId: "47001", title: "Học bổng A & B", imageUrl: "https://admin.cms.ueb.edu.vn/x.png", type: "scholarship" });
    expect(it.deadlineAt).toBe("2026-12-30T16:59:59.000Z");
  });
  it("finds the last deadline-looking date only", () => {
    expect(findDeadline("Đăng ngày 01/01/2026. Hạn đăng ký 15/12/2026")).toBe("2026-12-15T16:59:59.000Z");
    expect(findDeadline("Không có hạn")).toBeNull();
  });
});

describe("status shown to members", () => {
  const now = Date.parse("2026-11-22T00:00:00Z");
  it("open, closing soon, expired and closed by the poster", () => {
    expect(stateOf({ state: "open", deadlineAt: null }, now).code).toBe("open");
    expect(stateOf({ state: "open", deadlineAt: "2026-12-30T00:00:00Z" }, now)).toMatchObject({ code: "open", label: "Còn 38 ngày" });
    expect(stateOf({ state: "open", deadlineAt: "2026-11-25T00:00:00Z" }, now)).toMatchObject({ code: "closing", label: "Còn 3 ngày" });
    expect(stateOf({ state: "open", deadlineAt: "2026-11-20T00:00:00Z" }, now).code).toBe("closed");
    expect(stateOf({ state: "closed", deadlineAt: null }, now).code).toBe("closed");
  });
});

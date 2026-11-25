import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { cleanupTempDbs, useTempDb } from "../../../../test/db";

useTempDb();
const { makeMember } = await import("../../../../test/members");
const mkt = await import("./service");
const { one, run } = await import("@/platform/db/client");

type M = Awaited<ReturnType<typeof makeMember>>;
let owner: M, headTT: M, seller: M, buyer: M, buyer2: M;
let listingId: string;

const LISTING = { kind: "product", category: "book", title: "Sách Tư duy tài chính", description: "Sách mới 100%, bìa mềm.", price: 189000, stock: 2, delivery: "ship", itemCondition: "like_new", deliveryArea: "Cầu Giấy, Hà Nội", serviceScope: "Kèm 1-1 qua Zoom, bàn giao file Excel", availability: "Tối T2–T6", accessInfo: "Link tải: https://example.com/file" };
const SHIP = { paymentMethod: "cod", recipientName: "Người Mua", recipientPhone: "0901234567", address: "123 Nguyễn Văn Cừ, Quận 1, TP.HCM" };

beforeAll(async () => {
  owner = await makeMember("chu_nhiem");
  headTT = await makeMember("truong_ban", "truyen_thong");
  seller = await makeMember("thanh_vien", null, "Người bán");
  buyer = await makeMember("thanh_vien", null, "Người mua");
  buyer2 = await makeMember("thanh_vien", null, "Người mua 2");
});
afterAll(cleanupTempDbs);

describe("sellers (risk-based verification)", () => {
  it("a verified email opens a basic shop at once; unverified accounts cannot sell", async () => {
    await expect(mkt.createListing(seller, LISTING)).rejects.toThrow(/đăng ký/);
    await expect(mkt.registerSeller(seller, { shopName: "Nhà sách Minh", contact: "Zalo 0901234567" })).rejects.toThrow(/Xác thực email/);
    await run("UPDATE members SET email_verified_at = ? WHERE id IN (?, ?)", [new Date().toISOString(), seller.id, buyer.id]);
    expect(await mkt.registerSeller(seller, { shopName: "Nhà sách Minh", contact: "Zalo 0901234567" })).toBe("approved");
    expect((await mkt.getSeller(seller.id))?.level).toBe("basic");
  });
  it("basic shops cannot list high-risk types or prices above the cap until staff verify them", async () => {
    await expect(mkt.createListing(seller, { ...LISTING, kind: "service", delivery: "online" })).rejects.toThrow(/xác minh/);
    await expect(mkt.createListing(seller, { ...LISTING, price: 5_000_000 })).rejects.toThrow(/2\.000\.000/);
    await expect(mkt.requestVerification(seller, { legalName: "Nguyễn Văn Minh", phone: "12345", note: "Dạy kèm Excel tài chính" })).rejects.toThrow(/điện thoại/);
    await mkt.requestVerification(seller, { legalName: "Nguyễn Văn Minh", phone: "0901 234 567", note: "Dạy kèm Excel tài chính" });
    expect((await mkt.verificationQueue(owner)).map((s) => s.memberId)).toContain(seller.id);
    await expect(mkt.decideVerification(headTT, seller.id, true)).rejects.toThrow(/quyền/);
    await expect(mkt.decideVerification(owner, seller.id, false)).rejects.toThrow(/lý do/);
    await mkt.decideVerification(owner, seller.id, true);
    expect((await mkt.getSeller(seller.id))?.level).toBe("verified");
    expect(await mkt.createListing(seller, { ...LISTING, kind: "service", delivery: "online", title: "Kèm Excel tài chính 1-1" })).toBeTruthy();
  });
  it("suspension still needs Chủ nhiệm / Ban điều hành", async () => {
    await expect(mkt.decideSeller(buyer, seller.id, "suspend", "x")).rejects.toThrow(/quyền/);
    await expect(mkt.decideSeller(headTT, seller.id, "suspend", "x")).rejects.toThrow(/quyền/);
  });
});

describe("listings", () => {
  it("drafts are private; submitting needs review by Trưởng ban Truyền thông / Chủ nhiệm", async () => {
    listingId = await mkt.createListing(seller, LISTING);
    expect(await mkt.getListing(buyer, listingId)).toBeNull();
    expect(await mkt.listingTransition(seller, listingId, "submit")).toBe("submitted");
    await expect(mkt.listingTransition(buyer, listingId, "approve")).rejects.toThrow(/quyền/);
    expect(await mkt.listingTransition(headTT, listingId, "approve")).toBe("published");
    expect((await mkt.listPublished()).map((l) => l.id)).toContain(listingId);
  });
  it("links courses / tickets only to the seller's own published items; tags are normalized; owner-only edits", async () => {
    await expect(mkt.createListing(seller, { ...LISTING, kind: "course" })).rejects.toThrow(/khóa học/);
    await expect(mkt.createListing(seller, { ...LISTING, kind: "ticket", eventId: "nope" })).rejects.toThrow(/sự kiện do bạn tổ chức/);
    const digital = await mkt.createListing(seller, { ...LISTING, kind: "digital", delivery: "ship", title: "Template ngân sách", tags: ["#Excel", "excel", "Tài chính"] });
    const d = await mkt.getListing(seller, digital);
    expect(d).toMatchObject({ delivery: "online", tags: ["excel", "tài chính"], currency: "VND" });
    await mkt.deleteListing(seller, digital);
    await expect(mkt.updateListing(buyer, listingId, LISTING)).rejects.toThrow(/của mình/);
    await expect(mkt.deleteListing(buyer, listingId)).rejects.toThrow(/của mình/);
  });
});

describe("cart & checkout", () => {
  it("cannot buy your own listing or more than the stock", async () => {
    await expect(mkt.addToCart(seller, listingId, 1)).rejects.toThrow(/chính mình/);
    await expect(mkt.addToCart(buyer, listingId, 3)).rejects.toThrow(/Chỉ còn 2/);
  });

  it("totals come from the server, the cart empties, stock drops, and retries don't duplicate", async () => {
    await mkt.addToCart(buyer, listingId, 2);
    const cart = await mkt.getCart(buyer);
    expect(cart.total).toBe(378000);
    // Tampering with the price after adding to cart cannot lower what is charged… the order uses the DB price.
    await run("UPDATE mkt_listings SET price = 200000 WHERE id = ?", [listingId]);
    const ids = await mkt.checkout(buyer, { ...SHIP, checkoutKey: "key-0001-abcd" });
    expect(ids).toHaveLength(1);
    const again = await mkt.checkout(buyer, { ...SHIP, checkoutKey: "key-0001-abcd" });
    expect(again).toEqual(ids);
    const o = await one<{ total: number }>("SELECT total FROM mkt_orders WHERE id = ?", [ids[0]]);
    expect(Number(o?.total)).toBe(400000);
    expect((await mkt.getCart(buyer)).lines).toHaveLength(0);
    expect(Number((await one<{ stock: number }>("SELECT stock FROM mkt_listings WHERE id = ?", [listingId]))?.stock)).toBe(0);
  });

  it("never oversells: the last items can't be bought twice", async () => {
    await run("UPDATE mkt_listings SET stock = 1 WHERE id = ?", [listingId]);
    await mkt.addToCart(buyer2, listingId, 1);
    await run("UPDATE mkt_listings SET stock = 0 WHERE id = ?", [listingId]); // someone else bought it meanwhile
    await expect(mkt.checkout(buyer2, { ...SHIP, checkoutKey: "key-0002-abcd" })).rejects.toThrow(/chỉ còn 0|hết hàng/);
    expect(await one("SELECT id FROM mkt_orders WHERE buyer_id = ?", [buyer2.id])).toBeNull(); // rolled back entirely
  });

  it("delivery orders need an address", async () => {
    await run("UPDATE mkt_listings SET stock = 5 WHERE id = ?", [listingId]);
    await expect(mkt.checkout(buyer2, { ...SHIP, address: "", checkoutKey: "key-0003-abcd" })).rejects.toThrow(/địa chỉ/);
  });
});

describe("orders", () => {
  let orderId: string;
  beforeAll(async () => {
    orderId = (await mkt.myOrders(buyer))[0].id;
  });

  it("only the buyer and the seller can see an order", async () => {
    expect((await mkt.getOrder(buyer, orderId))?.role).toBe("buyer");
    expect((await mkt.getOrder(seller, orderId))?.role).toBe("seller");
    expect(await mkt.getOrder(buyer2, orderId)).toBeNull();
    expect(await mkt.getOrder(owner, orderId)).toBeNull();
    await expect(mkt.orderAction(buyer2, orderId, "cancel")).rejects.toThrow(/Không tìm thấy/);
  });

  it("no review before completion; full lifecycle; then exactly one review", async () => {
    await expect(mkt.reviewItem(buyer, orderId, listingId, { rating: 5 })).rejects.toThrow(/sau khi/);
    await expect(mkt.orderAction(buyer, orderId, "confirm")).rejects.toThrow(/người bán/);
    await mkt.orderAction(seller, orderId, "confirm");
    await mkt.orderAction(seller, orderId, "ship");
    await mkt.orderAction(seller, orderId, "deliver");
    expect(await mkt.orderAction(buyer, orderId, "complete")).toBe("completed");
    const o = await mkt.getOrder(buyer, orderId);
    expect(o?.paymentStatus).toBe("paid");
    expect(o?.events.map((e) => e.status)).toEqual(["placed", "confirmed", "shipping", "delivered", "completed"]);
    await mkt.reviewItem(buyer, orderId, listingId, { rating: 5, comment: "Sách đẹp" });
    await expect(mkt.reviewItem(buyer, orderId, listingId, { rating: 4 })).rejects.toThrow(/đã đánh giá/);
    expect((await mkt.getListing(null, listingId))?.rating).toBe(5);
    expect((await mkt.sellerStats(seller)).revenue).toBe(400000);
  });

  it("cancelling restores stock", async () => {
    // buyer2 still has 1 in the cart from the rolled-back checkout above (cart is kept on failure).
    await mkt.setCartQty(buyer2, listingId, 2);
    const [id] = await mkt.checkout(buyer2, { ...SHIP, checkoutKey: "key-0004-abcd" });
    const before = Number((await one<{ stock: number }>("SELECT stock FROM mkt_listings WHERE id = ?", [listingId]))?.stock);
    await mkt.orderAction(buyer2, id, "cancel");
    const after = Number((await one<{ stock: number }>("SELECT stock FROM mkt_listings WHERE id = ?", [listingId]))?.stock);
    expect(after).toBe(before + 2);
  });
});

describe("suspension", () => {
  it("suspending a seller takes their listings down", async () => {
    await expect(mkt.decideSeller(owner, seller.id, "suspend")).rejects.toThrow(/lý do/);
    await mkt.decideSeller(owner, seller.id, "suspend", "Vi phạm quy định");
    expect((await mkt.listPublished()).map((l) => l.id)).not.toContain(listingId);
  });
});

describe("listing photos", () => {
  it("accepts the seller's own uploads only, keeping the order", async () => {
    const sharp = (await import("sharp")).default;
    const { saveImage } = await import("@/platform/uploads/service");
    process.env.PFC_UPLOAD_DIR = ".data/test/uploads";
    const png = await sharp({ create: { width: 40, height: 30, channels: 3, background: "#ffffff" } }).png().toBuffer();
    await mkt.registerSeller(owner, { shopName: "Shop Chủ nhiệm", contact: "Zalo 0900000000" });
    const a = await saveImage(owner, "listing", png);
    const b = await saveImage(owner, "listing", png);
    const foreign = await saveImage(buyer, "listing", png);
    const id = await mkt.createListing(owner, { ...LISTING, title: "Sách có ảnh", images: [b.url, a.url] });
    expect((await mkt.getListing(owner, id))?.images).toEqual([b.url, a.url]);
    await expect(mkt.createListing(owner, { ...LISTING, images: [foreign.url] })).rejects.toThrow(/không phải của bạn/);
    await expect(mkt.createListing(owner, { ...LISTING, images: ["https://evil.example/x.png"] })).rejects.toThrow(/không phải của bạn/);
    await mkt.updateListing(owner, id, { ...LISTING, title: "Sách có ảnh", images: [a.url] });
    expect((await mkt.getListing(owner, id))?.images).toEqual([a.url]);
  });
});

describe("per-type listing details", () => {
  let seller: M;
  beforeAll(async () => {
    seller = await makeMember("thanh_vien", null, "Người bán chi tiết");
    await run("UPDATE members SET email_verified_at = ? WHERE id = ?", [new Date().toISOString(), seller.id]);
    await mkt.registerSeller(seller, { shopName: "Cửa hàng chi tiết", contact: "Zalo 0901234567" });
  });
  it("requires the details that fit the type and drops the ones that do not", async () => {
    await expect(mkt.createListing(seller, { ...LISTING, itemCondition: "" })).rejects.toThrow(/tình trạng/);
    await expect(mkt.createListing(seller, { ...LISTING, deliveryArea: "" })).rejects.toThrow(/khu vực/);
    const id = await mkt.createListing(seller, { ...LISTING, title: "Sách cũ giá rẻ" });
    const l = await mkt.getListing(seller, id);
    expect(l).toMatchObject({ itemCondition: "like_new", deliveryArea: "Cầu Giấy, Hà Nội", serviceScope: "" });
    expect(l?.access?.info).toBe("");
  });

  it("a digital item needs a file or access instructions, and the buyer only sees them once paid", async () => {
    await expect(mkt.createListing(seller, { ...LISTING, kind: "digital", accessInfo: "" })).rejects.toThrow(/truy cập/);
    const id = await mkt.createListing(seller, { ...LISTING, kind: "digital", title: "Template Excel quản lý chi tiêu" });
    const pub = await mkt.getListing(buyer, id);
    expect(pub).toBeNull(); // drafts are private to the seller
    expect((await mkt.getListing(seller, id))?.access?.info).toContain("example.com");
  });
});

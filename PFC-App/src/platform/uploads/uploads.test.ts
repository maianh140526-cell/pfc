import sharp from "sharp";
import { afterAll, describe, expect, it } from "vitest";
import { cleanupTempDbs, useTempDb } from "../../../test/db";

useTempDb();
process.env.PFC_UPLOAD_DIR = ".data/test/uploads";
const { sniffImage, processImage } = await import("./image");
const { saveImage, ownUploadUrls } = await import("./service");
const { readLocalObject, isValidKey } = await import("./storage");
const { makeMember } = await import("../../../test/members");
afterAll(cleanupTempDbs);

const jpegWithGps = () =>
  sharp({ create: { width: 3000, height: 2000, channels: 3, background: "#7a5af8" } })
    .jpeg()
    .withExif({ IFD0: { Make: "PhoneCo", Model: "X" }, IFD3: { GPSLatitudeRef: "N", GPSLatitude: "21/1 1/1 0/1" } })
    .toBuffer();

describe("image intake", () => {
  it("sniffs real bytes, not names", async () => {
    expect(sniffImage(await jpegWithGps())).toBe("image/jpeg");
    expect(sniffImage(Buffer.from("<svg onload=alert(1)>"))).toBeNull();
    expect(sniffImage(Buffer.from("GIF89a......"))).toBeNull();
  });
  it("downsizes, re-encodes to WebP and strips EXIF / GPS", async () => {
    const out = await processImage(await jpegWithGps());
    expect(out.mime).toBe("image/webp");
    expect(Math.max(out.width, out.height)).toBe(1600);
    const meta = await sharp(out.data).metadata();
    expect(meta.exif).toBeUndefined();
  });
  it("refuses non-images, empty and corrupt files", async () => {
    await expect(processImage(Buffer.alloc(0))).rejects.toThrow(/rỗng/);
    await expect(processImage(Buffer.from("%PDF-1.7 hello"))).rejects.toThrow(/JPG, PNG/);
    const broken = Buffer.concat([Buffer.from([0xff, 0xd8, 0xff]), Buffer.alloc(100)]);
    await expect(processImage(broken)).rejects.toThrow(/hỏng/);
  });
});

describe("upload ownership", () => {
  it("stores the cleaned file and only lets the owner attach it", async () => {
    const a = await makeMember();
    const b = await makeMember();
    const up = await saveImage(a, "listing", await jpegWithGps());
    expect(up.url).toBe(`/api/files/listing/${up.id}.webp`);
    expect(await readLocalObject(`listing/${up.id}.webp`)).not.toBeNull();
    expect(await ownUploadUrls(a, "listing", [up.id], 6)).toEqual([up.url]);
    await expect(ownUploadUrls(b, "listing", [up.id], 6)).rejects.toThrow(/không phải của bạn/);
    await expect(ownUploadUrls(a, "avatar", [up.id], 6)).rejects.toThrow();
    await expect(ownUploadUrls(a, "listing", ["https://evil.example/x.png"], 6)).rejects.toThrow(/không hợp lệ/);
    await expect(ownUploadUrls(a, "listing", [up.id, up.id, up.id], 2)).rejects.toThrow(/Tối đa 2/);
  });
  it("rejects path tricks in storage keys", () => {
    expect(isValidKey("listing/0b9f3c1e-1111-2222-3333-444455556666.webp")).toBe(true);
    expect(isValidKey("../../.env.local")).toBe(false);
    expect(isValidKey("listing/../../x.webp")).toBe(false);
  });
});

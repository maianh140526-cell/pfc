// Generates PWA / iOS / favicon icons from the official PFC logo.
// Source: PFC-Personal Finance/assets/branding/pfc-logo.png (2048², gear mark on top, wordmark below).
// Usage: npm run icons   (outputs are committed; re-run only when the logo changes)
import sharp from "sharp";
import { mkdir } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const SRC = path.resolve(root, "../PFC-Personal Finance/assets/branding/pfc-logo.png");
const OUT_ICONS = path.join(root, "public/icons");
const OUT_BRAND = path.join(root, "public/brand");
const BG = { r: 247, g: 244, b: 239, alpha: 1 }; // logo background tone (#f7f4ef)

// Square around the gear mark only (excludes the "PFC / PERSONAL FINANCE CLUB" wordmark).
const MARK = { left: 380, top: 76, width: 1280, height: 1280 };

await mkdir(OUT_ICONS, { recursive: true });
await mkdir(OUT_BRAND, { recursive: true });

const mark = await sharp(SRC).extract(MARK).png().toBuffer();

async function plain(size, file) {
  await sharp(mark).resize(size, size).flatten({ background: BG }).png().toFile(file);
}

// Maskable: launchers crop to a circle/squircle using the inner 80% — pad the mark.
async function maskable(size, file) {
  const inner = Math.round(size * 0.72);
  const pad = Math.round((size - inner) / 2);
  const resized = await sharp(mark).resize(inner, inner).png().toBuffer();
  await sharp({ create: { width: size, height: size, channels: 4, background: BG } })
    .composite([{ input: resized, left: pad, top: pad }])
    .flatten({ background: BG })
    .png()
    .toFile(file);
}

await plain(192, path.join(OUT_ICONS, "icon-192.png"));
await plain(512, path.join(OUT_ICONS, "icon-512.png"));
await maskable(192, path.join(OUT_ICONS, "maskable-192.png"));
await maskable(512, path.join(OUT_ICONS, "maskable-512.png"));
await maskable(180, path.join(OUT_ICONS, "apple-touch-icon.png")); // iOS rounds corners itself
await plain(32, path.join(OUT_ICONS, "favicon-32.png"));
await plain(128, path.join(OUT_BRAND, "pfc-mark.png"));
await sharp(SRC).resize(512, 512).png().toFile(path.join(OUT_BRAND, "pfc-logo-512.png"));

console.log("Icons written to public/icons and public/brand");

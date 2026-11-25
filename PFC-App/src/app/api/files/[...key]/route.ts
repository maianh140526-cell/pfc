import { NextResponse } from "next/server";
import { FILE_MIME, type FileExt } from "@/platform/uploads/attachment";
import { readLocalObject, storageMode } from "@/platform/uploads/storage";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/** Development file server for uploads (production serves files directly from Vercel Blob). */
export async function GET(_req: Request, { params }: { params: Promise<{ key: string[] }> }) {
  if (storageMode() !== "local") return new NextResponse(null, { status: 404 });
  const { key } = await params;
  const k = key.join("/");
  const data = await readLocalObject(k);
  if (!data) return new NextResponse(null, { status: 404 });
  const ext = k.split(".").pop() ?? "";
  const isFile = ext !== "webp" && ext in FILE_MIME;
  return new NextResponse(new Uint8Array(data), {
    headers: {
      "content-type": isFile ? FILE_MIME[ext as FileExt] : "image/webp",
      // PDFs open in the browser; Word / Excel / PowerPoint / text files are always downloaded, never rendered.
      ...(isFile ? { "content-disposition": `${ext === "pdf" ? "inline" : "attachment"}; filename="tai-lieu.${ext}"` } : {}),
      "cache-control": "public, max-age=31536000, immutable",
      "x-content-type-options": "nosniff",
      "content-security-policy": isFile ? "default-src 'none'; sandbox" : "default-src 'none'; img-src 'self'; style-src 'none'; sandbox",
    },
  });
}

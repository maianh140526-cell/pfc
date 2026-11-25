import { NextResponse, type NextRequest } from "next/server";
import { currentMember, toActor } from "@/platform/auth/session";
import { ActionError } from "@/platform/errors";
import { MAX_UPLOAD_BYTES } from "@/platform/uploads/image";
import { MAX_DOCUMENT_BYTES, UPLOAD_PURPOSES, saveAttachment, saveDocument, saveImage, type UploadPurpose } from "@/platform/uploads/service";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const json = (body: unknown, status = 200) => NextResponse.json(body, { status, headers: { "cache-control": "no-store" } });

/**
 * POST multipart/form-data { file, purpose } → { id, url, width, height }. Signed-in members only.
 * Images are re-encoded (metadata stripped); purpose "document" accepts a checked PDF only.
 */
export async function POST(req: NextRequest) {
  const me = await currentMember();
  if (!me) return json({ error: "Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại." }, 401);
  // Same-origin only (the session cookie is SameSite=Lax; this blocks cross-site form posts outright).
  const origin = req.headers.get("origin");
  if (origin && origin !== req.nextUrl.origin) return json({ error: "Nguồn yêu cầu không hợp lệ." }, 403);
  const len = Number(req.headers.get("content-length") ?? 0);
  if (len > Math.max(MAX_UPLOAD_BYTES, MAX_DOCUMENT_BYTES) + 64 * 1024) return json({ error: "Tệp quá lớn." }, 413);

  let form: FormData;
  try {
    form = await req.formData();
  } catch {
    return json({ error: "Dữ liệu tải lên không hợp lệ." }, 400);
  }
  const purpose = String(form.get("purpose") ?? "");
  const file = form.get("file");
  if (!(UPLOAD_PURPOSES as readonly string[]).includes(purpose)) return json({ error: "Mục đích tải lên không hợp lệ." }, 400);
  const isDoc = purpose === "document";
  if (!(file instanceof File)) return json({ error: isDoc ? "Chưa chọn tệp." : "Chưa chọn ảnh." }, 400);
  if (file.size > (isDoc ? MAX_DOCUMENT_BYTES : MAX_UPLOAD_BYTES)) return json({ error: isDoc ? "Tệp PDF tối đa 4 MB." : "Ảnh tối đa 8 MB." }, 413);

  try {
    const buf = Buffer.from(await file.arrayBuffer());
    if (purpose === "attachment") return json(await saveAttachment(toActor(me), buf, file.name), 201);
    const up = isDoc ? await saveDocument(toActor(me), buf) : await saveImage(toActor(me), purpose as UploadPurpose, buf);
    return json(up, 201);
  } catch (err) {
    if (err instanceof ActionError) return json({ error: err.message, code: err.code }, err.code === "rate_limited" ? 429 : 400);
    console.error("[upload]", err);
    return json({ error: isDoc ? "Không tải được tài liệu. Vui lòng thử lại." : "Không tải được ảnh. Vui lòng thử lại." }, 500);
  }
}

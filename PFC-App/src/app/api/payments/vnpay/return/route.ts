import { NextResponse, type NextRequest } from "next/server";
import { publicUrl } from "@/platform/mail";
import { handleVnpay } from "@/modules/payments/server/service";

export const dynamic = "force-dynamic";

/**
 * VNPAY Return URL: the payer's browser comes back here. The result is verified (signature, amount)
 * and applied once — the IPN may already have done it. Then we show PFC's own result page.
 */
export async function GET(req: NextRequest) {
  const query = Object.fromEntries(req.nextUrl.searchParams.entries());
  let target = "/payments?error=1";
  try {
    const r = await handleVnpay(query, "return");
    if (r.paymentId) target = `/payments/${r.paymentId}?from=vnpay`;
  } catch (err) {
    console.error("[vnpay:return]", err);
  }
  return NextResponse.redirect(new URL(target, publicUrl()), { status: 303 });
}

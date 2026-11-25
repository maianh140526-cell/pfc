import { NextResponse, type NextRequest } from "next/server";
import { handleVnpay } from "@/modules/payments/server/service";

export const dynamic = "force-dynamic";

/**
 * VNPAY IPN (server-to-server). Response codes per the VNPAY integration guide:
 * 00 confirmed · 01 order not found · 02 already confirmed · 04 invalid amount · 97 invalid signature · 99 unknown error.
 */
export async function GET(req: NextRequest) {
  const query = Object.fromEntries(req.nextUrl.searchParams.entries());
  const reply = (RspCode: string, Message: string) => NextResponse.json({ RspCode, Message }, { headers: { "cache-control": "no-store" } });
  try {
    const r = await handleVnpay(query, "ipn");
    switch (r.code) {
      case "ok":
        return reply("00", "Confirm Success");
      case "already":
        return reply("02", "Order already confirmed");
      case "invalid_amount":
        return reply("04", "Invalid amount");
      case "invalid_signature":
        return reply("97", "Invalid signature");
      case "not_found":
        return reply("01", "Order not found");
    }
  } catch (err) {
    console.error("[vnpay:ipn]", err);
  }
  return reply("99", "Unknown error");
}

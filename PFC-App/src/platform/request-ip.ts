import "server-only";
import { headers } from "next/headers";

/** Client IP (first X-Forwarded-For hop set by the hosting proxy). VNPAY requires one on every payment. */
export async function requestIp(): Promise<string> {
  const h = await headers();
  const ip = h.get("x-forwarded-for")?.split(",")[0]?.trim() || h.get("x-real-ip") || "";
  return /^[0-9a-fA-F:.]{3,45}$/.test(ip) ? ip : "127.0.0.1";
}

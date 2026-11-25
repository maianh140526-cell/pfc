import "server-only";

/**
 * Transactional email (verification, password reset).
 * PFC_MAIL_MODE:
 *   - "resend": send through Resend's HTTP API (RESEND_API_KEY, PFC_MAIL_FROM). Use in production.
 *   - "log":    print the message to the server log instead of sending (local development only).
 * Default: "log" outside production; in production nothing is sent until a provider is configured.
 */
export type Mail = { to: string; subject: string; text: string };

export function mailMode(): "resend" | "log" | "off" {
  const m = process.env.PFC_MAIL_MODE;
  if (m === "resend" || m === "log") return m;
  return process.env.NODE_ENV === "production" ? "off" : "log";
}

/** Public origin used in links inside emails. Never derived from the request Host header. */
export function publicUrl(): string {
  return (process.env.PFC_PUBLIC_URL || "http://localhost:3200").replace(/\/$/, "");
}

export async function sendMail(mail: Mail): Promise<boolean> {
  const mode = mailMode();
  if (mode === "log") {
    console.info(`\n[mail:log] To: ${mail.to}\n[mail:log] Subject: ${mail.subject}\n${mail.text}\n`);
    return true;
  }
  if (mode === "off") {
    console.error("[mail] PFC_MAIL_MODE is not configured; email not sent:", mail.subject);
    return false;
  }
  const key = process.env.RESEND_API_KEY;
  const from = process.env.PFC_MAIL_FROM;
  if (!key || !from) {
    console.error("[mail] RESEND_API_KEY / PFC_MAIL_FROM missing; email not sent.");
    return false;
  }
  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { authorization: `Bearer ${key}`, "content-type": "application/json" },
      body: JSON.stringify({ from, to: [mail.to], subject: mail.subject, text: mail.text }),
      signal: AbortSignal.timeout(10_000),
    });
    if (!res.ok) console.error("[mail] provider error", res.status);
    return res.ok;
  } catch (err) {
    console.error("[mail] send failed", err);
    return false;
  }
}

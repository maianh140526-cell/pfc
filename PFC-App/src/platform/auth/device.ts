/**
 * Human label for a signed-in device (mockup 269 "Quản lý thiết bị đăng nhập") from the User-Agent,
 * plus a coarse IP hint. Pure and unit tested. We never store the full UA or the full IP.
 */
export function deviceLabel(ua: string | null | undefined): string {
  const s = ua ?? "";
  const os = /iPhone/.test(s)
    ? "iPhone"
    : /iPad/.test(s)
      ? "iPad"
      : /Android/.test(s)
        ? "Android"
        : /Windows/.test(s)
          ? "Windows"
          : /Mac OS X|Macintosh/.test(s)
            ? "macOS"
            : /Linux/.test(s)
              ? "Linux"
              : "Thiết bị khác";
  const browser = /Edg\//.test(s)
    ? "Edge"
    : /OPR\/|Opera/.test(s)
      ? "Opera"
      : /SamsungBrowser/.test(s)
        ? "Samsung Internet"
        : /CriOS|Chrome\//.test(s)
          ? "Chrome"
          : /FxiOS|Firefox\//.test(s)
            ? "Firefox"
            : /Safari\//.test(s)
              ? "Safari"
              : "Trình duyệt";
  return `${browser} · ${os}`;
}

/** IPv4 → "113.161.x.x"; IPv6 → first two groups; anything else → null. */
export function ipHint(ip: string | null | undefined): string | null {
  if (!ip || ip === "local") return null;
  const v4 = /^(\d{1,3})\.(\d{1,3})\.\d{1,3}\.\d{1,3}$/.exec(ip);
  if (v4) return `${v4[1]}.${v4[2]}.x.x`;
  if (ip.includes(":")) {
    const parts = ip.split(":").filter(Boolean);
    return parts.length >= 2 ? `${parts[0]}:${parts[1]}:…` : null;
  }
  return null;
}

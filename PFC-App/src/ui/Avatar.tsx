import { cx } from "./cx";

/** Member avatar: uploaded photo, or initials on the brand colour. */
export function Avatar({ name, url, size = 48, className }: { name: string; url?: string | null; size?: number; className?: string }) {
  const initials =
    name
      .trim()
      .split(/\s+/)
      .slice(-2)
      .map((w) => w[0]?.toUpperCase())
      .join("") || "?";
  if (url) {
    // eslint-disable-next-line @next/next/no-img-element -- server-processed 512px WebP
    return <img src={url} alt="" width={size} height={size} className={cx("shrink-0 rounded-full object-cover", className)} style={{ width: size, height: size }} />;
  }
  return (
    <span
      aria-hidden="true"
      className={cx("grid shrink-0 place-items-center rounded-full bg-primary font-bold text-on-primary", className)}
      style={{ width: size, height: size, fontSize: Math.round(size * 0.36) }}
    >
      {initials}
    </span>
  );
}

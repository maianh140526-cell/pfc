import { cx } from "@/ui/cx";

/*
 * Brand marks: the only hard-coded colours in the app, required by Google / Facebook
 * sign-in branding guidelines (official multi-colour "G" and the Facebook blue "f").
 */
function GoogleMark() {
  return (
    <svg viewBox="0 0 48 48" width="20" height="20" aria-hidden="true">
      <path fill="#FFC107" d="M43.6 20.5H42V20H24v8h11.3C33.7 32.7 29.2 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20 20-8.9 20-20c0-1.3-.1-2.4-.4-3.5z" />
      <path fill="#FF3D00" d="M6.3 14.7l6.6 4.8C14.7 15.1 19 12 24 12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 16.3 4 9.7 8.3 6.3 14.7z" />
      <path fill="#4CAF50" d="M24 44c5.2 0 9.9-2 13.4-5.2l-6.2-5.2C29.2 35.1 26.7 36 24 36c-5.2 0-9.6-3.3-11.3-8l-6.5 5C9.5 39.6 16.2 44 24 44z" />
      <path fill="#1976D2" d="M43.6 20.5H42V20H24v8h11.3c-.8 2.2-2.2 4.2-4.1 5.6l6.2 5.2C37 39.2 44 34 44 24c0-1.3-.1-2.4-.4-3.5z" />
    </svg>
  );
}

function FacebookMark() {
  return (
    <svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true">
      <path fill="#1877F2" d="M24 12.07C24 5.4 18.63 0 12 0S0 5.4 0 12.07C0 18.1 4.39 23.1 10.13 24v-8.44H7.08v-3.49h3.05V9.41c0-3.02 1.79-4.69 4.53-4.69 1.31 0 2.68.24 2.68.24v2.97h-1.51c-1.49 0-1.96.93-1.96 1.89v2.25h3.33l-.53 3.49h-2.8V24C19.61 23.1 24 18.1 24 12.07z" />
      <path fill="#fff" d="M16.67 15.56l.53-3.49h-3.33V9.82c0-.96.47-1.89 1.96-1.89h1.51V4.96s-1.37-.24-2.68-.24c-2.74 0-4.53 1.67-4.53 4.69v2.66H7.08v3.49h3.05V24a12.3 12.3 0 003.74 0v-8.44h2.8z" />
    </svg>
  );
}

const btn = "pressable flex min-h-12 w-full items-center justify-center gap-3 rounded-[var(--radius-control,16px)] border border-line bg-surface px-4 text-[15px] font-semibold text-ink";

/**
 * SYS-02 social sign-in. Plain links to the server start route (no client secrets, no SDKs).
 * When a provider is not configured on the server the button is shown disabled with a reason.
 */
export function SocialButtons({
  providers,
  next,
  remember,
  register,
}: {
  providers: { google: boolean; facebook: boolean };
  next?: string;
  remember: boolean;
  register?: boolean;
}) {
  const href = (p: string) => {
    const q = new URLSearchParams({ remember: remember ? "1" : "0" });
    if (next) q.set("next", next);
    return `/api/auth/oauth/${p}/start?${q.toString()}`;
  };
  const verb = register ? "Đăng ký" : "Đăng nhập";
  const items = [
    { id: "google", label: `${verb} bằng Google`, mark: <GoogleMark />, on: providers.google },
    { id: "facebook", label: `${verb} bằng Facebook`, mark: <FacebookMark />, on: providers.facebook },
  ];
  const off = items.filter((i) => !i.on);
  return (
    <div className="space-y-3">
      {items.map((i) =>
        i.on ? (
          <a key={i.id} href={href(i.id)} className={btn}>
            {i.mark} {i.label}
          </a>
        ) : (
          <button key={i.id} type="button" disabled aria-disabled="true" className={cx(btn, "cursor-not-allowed opacity-50")}>
            {i.mark} {i.label}
          </button>
        ),
      )}
      {off.length > 0 && (
        <p className="text-center text-[12px] text-muted">
          {off.map((i) => (i.id === "google" ? "Google" : "Facebook")).join(" và ")} chưa được bật trên máy chủ này — dùng email và mật khẩu.
        </p>
      )}
    </div>
  );
}

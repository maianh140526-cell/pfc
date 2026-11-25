"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useState, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";

function GoogleGIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 48 48" aria-hidden>
      <path
        fill="#EA4335"
        d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"
      />
      <path
        fill="#4285F4"
        d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"
      />
      <path
        fill="#FBBC05"
        d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"
      />
      <path
        fill="#34A853"
        d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"
      />
    </svg>
  );
}

function LoginInner() {
  const router = useRouter();
  const search = useSearchParams();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [googleEnabled, setGoogleEnabled] = useState(false);
  const [googleMode, setGoogleMode] = useState<string>("off");
  const [googleBusy, setGoogleBusy] = useState(false);
  const [ssoEnabled, setSsoEnabled] = useState(false);
  const [ssoBusy, setSsoBusy] = useState(false);

  useEffect(() => {
    const code = search.get("sso_error");
    if (code) setError(`Đăng nhập xã hội lỗi: ${code}`);
    void fetch("/api/club?action=sso_status")
      .then((r) => r.json())
      .then((d) => {
        setSsoEnabled(!!d.sso?.enabled);
        setGoogleEnabled(!!d.google?.enabled);
        setGoogleMode(String(d.google?.mode ?? "off"));
      })
      .catch(() => {
        setSsoEnabled(false);
        setGoogleEnabled(false);
      });
  }, [search]);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      await fetch("/api/club?action=bootstrap");
      const res = await fetch("/api/club", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ action: "login", email, password }),
      });
      const data = await res.json();
      if (!res.ok || !data.ok) {
        setError(data.error?.message ?? "Đăng nhập thất bại");
        return;
      }
      router.push("/lobby");
      router.refresh();
    } catch {
      setError("Không kết nối được máy chủ");
    } finally {
      setLoading(false);
    }
  }

  async function onGoogle() {
    setGoogleBusy(true);
    setError(null);
    try {
      await fetch("/api/club?action=bootstrap");
      const res = await fetch("/api/club", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ action: "google_start" }),
      });
      const data = await res.json();
      if (!res.ok || !data.google?.url) {
        setError(
          data.error?.message ??
            "Google Sign-In chưa cấu hình (GOOGLE_OAUTH_MODE=dev hoặc CLIENT_ID/SECRET)",
        );
        setGoogleBusy(false);
        return;
      }
      window.location.href = data.google.url;
    } catch {
      setError("Google Sign-In không khả dụng");
      setGoogleBusy(false);
    }
  }

  async function onPlatformSso() {
    setSsoBusy(true);
    setError(null);
    try {
      await fetch("/api/club?action=bootstrap");
      const res = await fetch("/api/club", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          action: "sso_start",
          email: email || "leader@pfc.vn",
          name: "PFC SSO Demo",
        }),
      });
      const data = await res.json();
      if (!res.ok || !data.sso?.url) {
        setError(data.error?.message ?? "Không mở được Platform SSO");
        setSsoBusy(false);
        return;
      }
      window.location.href = data.sso.url;
    } catch {
      setError("SSO không khả dụng");
      setSsoBusy(false);
    }
  }

  return (
    <div className="login-shell">
      <div className="login-card">
        <Link href="/lobby" aria-label="Về Lobby" className="login-logo-link">
          <Image
            src="/pfc-logo.svg"
            alt="Personal Finance Club"
            width={120}
            height={120}
            className="logo-hero"
            priority
          />
        </Link>
        <h1 className="login-title">Chào mừng trở lại!</h1>
        <p className="login-sub">Đăng nhập vào Personal Finance Club</p>

        <form onSubmit={onSubmit} className="login-form">
          <div className={`float-field${email ? " filled" : ""}`}>
            <input
              id="login-email"
              type="email"
              autoComplete="username"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder=" "
              required
            />
            <label htmlFor="login-email">Email</label>
          </div>
          <div className={`float-field${password ? " filled" : ""}`}>
            <input
              id="login-password"
              type="password"
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder=" "
              required
            />
            <label htmlFor="login-password">Mật khẩu</label>
          </div>

          {error && <div className="error-banner">{error}</div>}

          <button
            type="submit"
            className="login-btn-email"
            disabled={loading || googleBusy}
          >
            {loading ? "Đang đăng nhập…" : "✨ Đăng nhập với Email"}
          </button>
        </form>

        <div className="login-divider" role="separator">
          <span>Hoặc đăng nhập bằng</span>
        </div>

        <button
          type="button"
          className="login-btn-google"
          disabled={googleBusy || loading || !googleEnabled}
          onClick={() => void onGoogle()}
          title={
            googleEnabled
              ? googleMode === "dev"
                ? "Google Sign-In (dev demo)"
                : "Tiếp tục với Google"
              : "Bật GOOGLE_OAUTH_MODE=dev hoặc cấu hình CLIENT_ID/SECRET"
          }
        >
          <GoogleGIcon />
          <span>
            {googleBusy
              ? "Đang kết nối…"
              : googleEnabled
                ? "🌐 Đăng nhập bằng Google"
                : "Google Sign-In (chưa bật)"}
          </span>
          {googleBusy && <span className="login-spinner" aria-hidden />}
        </button>

        {ssoEnabled && (
          <button
            type="button"
            className="login-btn-platform"
            disabled={ssoBusy || loading}
            onClick={() => void onPlatformSso()}
          >
            {ssoBusy ? "Đang chuyển SSO…" : "Đăng nhập PFC SSO (Platform Core)"}
          </button>
        )}

        <p className="login-hint">
          Demo email: <code>leader@pfc.vn</code> / <code>PFC123!</code>
          {googleEnabled
            ? googleMode === "dev"
              ? " · Google: chế độ dev (không cần Client ID)"
              : " · Google OAuth live"
            : " · Google tắt — set GOOGLE_OAUTH_MODE=dev trong .env.local"}
        </p>
      </div>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={<p className="muted login-loading">Đang tải…</p>}>
      <LoginInner />
    </Suspense>
  );
}

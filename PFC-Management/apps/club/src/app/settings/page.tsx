"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { AppHeader } from "@/components/MobileChrome";
import { useClubData } from "@/components/useClubData";

const POSITION_LABEL: Record<string, string> = {
  owner: "Chủ nhiệm",
  leader: "Ban Điều hành",
  ban_chuyen_mon: "Ban Chuyên môn",
  ban_truyen_thong: "Ban Truyền thông",
  ban_su_kien: "Ban Sự kiện / HR",
  member: "Thành viên",
};

function initials(name?: string | null) {
  if (!name) return "?";
  return name
    .split(" ")
    .slice(-2)
    .map((p) => p[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
}

export default function SettingsPage() {
  const router = useRouter();
  const { data, error, post, can } = useClubData();
  const [pushOn, setPushOn] = useState(false);
  const [prefsLoading, setPrefsLoading] = useState(true);
  const [confirmOut, setConfirmOut] = useState(false);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  const user = data?.user;
  const membership = data?.myMembership;
  const teamName =
    data?.teams?.find((t) => t.id === membership?.teamId)?.name ?? null;
  const roleLabel =
    POSITION_LABEL[membership?.position ?? ""] ??
    membership?.position ??
    "Thành viên";

  useEffect(() => {
    void fetch("/api/club?action=notify_prefs")
      .then((r) => r.json())
      .then((j) => {
        if (j.ok && j.prefs) setPushOn(!!j.prefs.push);
      })
      .catch(() => undefined)
      .finally(() => setPrefsLoading(false));
  }, []);

  async function togglePush(next: boolean) {
    setPushOn(next);
    setBusy(true);
    setMsg(null);
    try {
      await post({ action: "update_notify_prefs", push: next, inApp: true });
      setMsg(next ? "Đã bật thông báo đẩy" : "Đã tắt thông báo đẩy");
    } catch (e) {
      setPushOn(!next);
      setMsg(e instanceof Error ? e.message : "Không lưu được");
    } finally {
      setBusy(false);
    }
  }

  async function logout() {
    setBusy(true);
    try {
      await fetch("/api/club", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ action: "logout" }),
      });
      router.push("/login");
      router.refresh();
    } finally {
      setBusy(false);
      setConfirmOut(false);
    }
  }

  return (
    <>
      <AppHeader title="Cài đặt" />
      {error && (
        <div className="error-banner">
          {error}{" "}
          <Link href="/login" className="btn-ghost">
            Đăng nhập
          </Link>
        </div>
      )}

      <section className="section">
        <div className="settings-profile">
          <div className="settings-avatar" aria-hidden>
            {initials(user?.fullName)}
          </div>
          <div className="settings-profile-text">
            <h2>{user?.fullName ?? "Khách"}</h2>
            <p className="muted">{user?.email ?? "—"}</p>
            <div className="settings-badges">
              <span className="settings-badge role">{roleLabel}</span>
              {teamName && (
                <span className="settings-badge team">{teamName}</span>
              )}
              <span className="settings-badge status">
                {membership?.status === "active" ? "● Đang hoạt động" : membership?.status ?? "—"}
              </span>
            </div>
          </div>
        </div>
      </section>

      <section className="section">
        <h3 className="settings-block-title">Tùy chọn & tiện ích</h3>
        <div className="settings-list">
          <label className="settings-row">
            <span className="settings-row-ico">🔔</span>
            <span className="settings-row-text">
              <strong>Cài đặt Thông báo</strong>
              <small>Push notification (stub Platform)</small>
            </span>
            <input
              type="checkbox"
              className="settings-switch"
              checked={pushOn}
              disabled={prefsLoading || busy || !user}
              onChange={(e) => void togglePush(e.target.checked)}
              aria-label="Bật thông báo đẩy"
            />
          </label>

          <Link href="/login" className="settings-row linkish">
            <span className="settings-row-ico">🔒</span>
            <span className="settings-row-text">
              <strong>Đổi mật khẩu & Bảo mật</strong>
              <small>Đăng nhập lại để xác thực</small>
            </span>
            <span className="settings-chevron">›</span>
          </Link>

          <div className="settings-row">
            <span className="settings-row-ico">🎨</span>
            <span className="settings-row-text">
              <strong>Giao diện ứng dụng</strong>
              <small>Plus Jakarta · violet pastel (mặc định)</small>
            </span>
          </div>

          <a
            className="settings-row linkish"
            href="mailto:leader@pfc.vn?subject=Hỗ trợ%20PFC%20Club"
          >
            <span className="settings-row-ico">❓</span>
            <span className="settings-row-text">
              <strong>Trung tâm hỗ trợ & Liên hệ BĐH</strong>
              <small>Email Ban Điều hành</small>
            </span>
            <span className="settings-chevron">›</span>
          </a>

          {can("manage_club") && (
            <Link href="/manage" className="settings-row linkish">
              <span className="settings-row-ico">🏛️</span>
              <span className="settings-row-text">
                <strong>Club Management</strong>
                <small>Quản lý · duyệt · ban</small>
              </span>
              <span className="settings-chevron">›</span>
            </Link>
          )}
        </div>
        {msg && <p className="settings-toast">{msg}</p>}
      </section>

      <section className="section">
        <button
          type="button"
          className="settings-logout"
          onClick={() => setConfirmOut(true)}
        >
          🚪 Đăng xuất
        </button>
      </section>

      {confirmOut && (
        <div
          className="task-modal-backdrop"
          role="dialog"
          aria-modal="true"
          onClick={() => setConfirmOut(false)}
        >
          <div
            className="task-modal settings-confirm"
            onClick={(e) => e.stopPropagation()}
          >
            <h2>Đăng xuất?</h2>
            <p className="muted">
              Bạn sẽ cần đăng nhập lại để dùng Công việc và Thông báo.
            </p>
            <div className="settings-confirm-actions">
              <button
                type="button"
                className="btn-ghost"
                onClick={() => setConfirmOut(false)}
              >
                Ở lại
              </button>
              <button
                type="button"
                className="settings-logout solid"
                disabled={busy}
                onClick={() => void logout()}
              >
                {busy ? "Đang thoát…" : "Đăng xuất"}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

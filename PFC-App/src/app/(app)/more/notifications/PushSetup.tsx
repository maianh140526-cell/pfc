"use client";

import { BellRing, Share } from "lucide-react";
import { useEffect, useState } from "react";
import { subscribePushAction, testPushAction, unsubscribePushAction } from "@/platform/notifications/actions";
import { Button, Card } from "@/ui";
import { FormError } from "@/ui/Form";

type State = "loading" | "unsupported" | "ios-install" | "denied" | "off" | "on";

function b64ToBytes(b64: string): Uint8Array<ArrayBuffer> {
  const pad = "=".repeat((4 - (b64.length % 4)) % 4);
  const raw = atob((b64 + pad).replace(/-/g, "+").replace(/_/g, "/"));
  const out = new Uint8Array(new ArrayBuffer(raw.length));
  for (let i = 0; i < raw.length; i++) out[i] = raw.charCodeAt(i);
  return out;
}

/** NOT-05: per-device opt-in. iPhone needs the app installed to the home screen first (iOS 16.4+). */
export function PushSetup({ configured, publicKey, devices }: { configured: boolean; publicKey: string; devices: number }) {
  const [state, setState] = useState<State>("loading");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [tested, setTested] = useState(false);

  useEffect(() => {
    (async () => {
      const ios = /iPhone|iPad/.test(navigator.userAgent);
      const standalone = window.matchMedia("(display-mode: standalone)").matches || (navigator as { standalone?: boolean }).standalone === true;
      if (!("serviceWorker" in navigator) || !("PushManager" in window) || !("Notification" in window)) {
        setState(ios && !standalone ? "ios-install" : "unsupported");
        return;
      }
      if (Notification.permission === "denied") return setState("denied");
      const reg = await navigator.serviceWorker.getRegistration();
      const sub = await reg?.pushManager.getSubscription();
      setState(sub ? "on" : "off");
    })().catch(() => setState("unsupported"));
  }, []);

  async function enable() {
    setBusy(true);
    setError(null);
    try {
      const perm = await Notification.requestPermission();
      if (perm !== "granted") return setState(perm === "denied" ? "denied" : "off");
      const reg = await navigator.serviceWorker.ready;
      const sub = await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: b64ToBytes(publicKey) });
      const r = await subscribePushAction(sub.toJSON() as { endpoint: string; keys: { p256dh: string; auth: string } });
      if (!r.ok) {
        await sub.unsubscribe();
        setError(r.error);
      } else setState("on");
    } catch {
      setError("Không bật được thông báo trên trình duyệt này.");
    } finally {
      setBusy(false);
    }
  }

  async function disable() {
    setBusy(true);
    try {
      const reg = await navigator.serviceWorker.getRegistration();
      const sub = await reg?.pushManager.getSubscription();
      if (sub) {
        await unsubscribePushAction(sub.endpoint);
        await sub.unsubscribe();
      }
      setState("off");
    } finally {
      setBusy(false);
    }
  }

  if (!configured) return <Card className="p-4 text-[14px] text-ink-2">Máy chủ chưa cấu hình thông báo đẩy (khóa VAPID). Bạn vẫn nhận thông báo trong ứng dụng và qua email.</Card>;

  return (
    <Card className="p-4">
      {state === "loading" && <p className="text-[14px] text-muted">Đang kiểm tra thiết bị…</p>}
      {state === "unsupported" && <p className="text-[14px] text-ink-2">Trình duyệt này không hỗ trợ thông báo đẩy. Hãy dùng Chrome, Edge, Firefox hoặc Safari mới.</p>}
      {state === "ios-install" && (
        <p className="flex gap-2 text-[14px] text-ink-2">
          <Share size={18} className="mt-0.5 shrink-0 text-primary" />
          Trên iPhone, hãy cài PFC lên màn hình chính trước: Safari → Chia sẻ → “Thêm vào MH chính”, rồi mở PFC từ biểu tượng đó và bật thông báo.
        </p>
      )}
      {state === "denied" && <p className="text-[14px] text-ink-2">Bạn đã chặn thông báo cho PFC. Mở cài đặt trang của trình duyệt để cho phép lại.</p>}
      {(state === "off" || state === "on") && (
        <>
          <p className="flex items-center gap-2 text-[15px] font-semibold text-ink">
            <BellRing size={18} className="text-primary" /> {state === "on" ? "Đang bật trên thiết bị này" : "Đang tắt trên thiết bị này"}
          </p>
          <p className="mt-1 text-[12px] text-muted">Đang bật trên {devices} thiết bị của bạn.</p>
          <div className="mt-3 grid gap-2">
            {state === "off" ? (
              <Button block disabled={busy} onClick={enable}>
                Bật thông báo đẩy
              </Button>
            ) : (
              <>
                <Button
                  variant="secondary"
                  block
                  disabled={busy}
                  onClick={async () => {
                    const r = await testPushAction();
                    if (r.ok) setTested(true);
                    else setError(r.error);
                  }}
                >
                  {tested ? "Đã gửi — kiểm tra thông báo" : "Gửi thông báo thử"}
                </Button>
                <Button variant="ghost" block disabled={busy} onClick={disable}>
                  Tắt trên thiết bị này
                </Button>
              </>
            )}
          </div>
        </>
      )}
      <FormError message={error} />
    </Card>
  );
}

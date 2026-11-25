"use client";

import { Camera, CameraOff, CheckCircle2, XCircle } from "lucide-react";
import { useEffect, useRef, useState, useTransition } from "react";
import { formatVnd } from "@/lib/money";
import { Button } from "@/ui";
import { TextInput } from "@/ui/Form";
import { checkInAction } from "../server/actions";
import type { CheckInResult } from "../server/service";

type Detector = { detect: (src: HTMLVideoElement) => Promise<{ rawValue: string }[]> };
declare global {
  interface Window {
    BarcodeDetector?: new (o: { formats: string[] }) => Detector;
  }
}

/** EVT-15 QR check-in. Uses the camera's BarcodeDetector where available, with manual code entry as fallback. */
export function CheckInScanner({ eventId }: { eventId: string }) {
  const video = useRef<HTMLVideoElement>(null);
  const busy = useRef(false);
  const last = useRef<{ code: string; at: number }>({ code: "", at: 0 });
  const [camera, setCamera] = useState<"off" | "on" | "unsupported" | "denied">("off");
  const [code, setCode] = useState("");
  const [pendingCode, setPendingCode] = useState<string | null>(null);
  const [result, setResult] = useState<CheckInResult | null>(null);
  const [, start] = useTransition();

  function submit(raw: string, collected = false) {
    if (busy.current) return;
    busy.current = true;
    start(async () => {
      const r = await checkInAction(eventId, raw, collected).catch(() => null);
      busy.current = false;
      if (!r) return setResult({ ok: false, error: "Không kết nối được máy chủ." });
      if (!r.ok) return setResult({ ok: false, error: r.error });
      setResult(r.data);
      setPendingCode(r.data.ok && r.data.collect > 0 ? raw : null);
      if (r.data.ok && r.data.collect === 0) setCode("");
      if ("vibrate" in navigator) navigator.vibrate(r.data.ok ? 60 : [40, 60, 40]);
    });
  }

  useEffect(() => {
    if (camera !== "on") return;
    let stream: MediaStream | null = null;
    let timer: ReturnType<typeof setInterval> | null = null;
    let stopped = false;
    (async () => {
      try {
        stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "environment" }, audio: false });
        if (stopped) return stream.getTracks().forEach((t) => t.stop());
        if (video.current) {
          video.current.srcObject = stream;
          await video.current.play();
        }
        const det = new window.BarcodeDetector!({ formats: ["qr_code"] });
        timer = setInterval(async () => {
          if (!video.current || busy.current) return;
          const found = await det.detect(video.current).catch(() => []);
          const raw = found[0]?.rawValue;
          if (!raw) return;
          if (raw === last.current.code && Date.now() - last.current.at < 4000) return;
          last.current = { code: raw, at: Date.now() };
          submit(raw);
        }, 400);
      } catch {
        setCamera("denied");
      }
    })();
    return () => {
      stopped = true;
      if (timer) clearInterval(timer);
      stream?.getTracks().forEach((t) => t.stop());
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [camera]);

  return (
    <div className="space-y-4 px-4 pb-6">
      {camera === "on" ? (
        <div className="relative overflow-hidden rounded-[var(--radius-card)] bg-black">
          <video ref={video} className="aspect-square w-full object-cover" muted playsInline />
          <div className="pointer-events-none absolute inset-[18%] rounded-3xl border-4 border-white/80" />
          <button type="button" onClick={() => setCamera("off")} className="absolute top-2 right-2 grid size-11 place-items-center rounded-full bg-black/50 text-white" aria-label="Tắt camera">
            <CameraOff size={20} />
          </button>
        </div>
      ) : (
        <Button
          block
          variant="secondary"
          onClick={() => {
            if (!window.BarcodeDetector || !navigator.mediaDevices?.getUserMedia) setCamera("unsupported");
            else setCamera("on");
          }}
        >
          <Camera size={18} /> Quét mã QR bằng camera
        </Button>
      )}
      {camera === "unsupported" && <p className="text-[13px] text-muted">Trình duyệt này chưa hỗ trợ quét QR. Nhập mã in dưới QR trên vé.</p>}
      {camera === "denied" && <p className="text-[13px] text-expense">Không mở được camera. Cho phép quyền camera hoặc nhập mã thủ công.</p>}

      <form
        className="flex items-end gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          if (code.trim()) submit(code.trim());
        }}
      >
        <div className="flex-1">
          <TextInput label="Mã vé" value={code} onChange={(e) => setCode(e.target.value.toUpperCase())} maxLength={24} autoCapitalize="characters" autoComplete="off" placeholder="12 ký tự" />
        </div>
        <Button type="submit" disabled={!code.trim()}>
          Check-in
        </Button>
      </form>

      {result && (
        <div role="status" aria-live="assertive" className={`rounded-[var(--radius-card)] p-4 ${result.ok ? (result.collect > 0 ? "bg-warning-soft" : "bg-income-soft") : "bg-expense-soft"}`}>
          {result.ok ? (
            result.collect > 0 ? (
              <>
                <p className="text-[16px] font-bold text-warning">Thu {formatVnd(result.collect)} trước khi vào</p>
                <p className="text-[14px] text-ink">
                  {result.attendee} · {result.ticketName}
                </p>
                <Button block className="mt-3" onClick={() => pendingCode && submit(pendingCode, true)}>
                  Đã thu tiền · Check-in
                </Button>
              </>
            ) : (
              <p className="flex items-center gap-2 text-[16px] font-bold text-income">
                <CheckCircle2 size={22} /> {result.attendee} · {result.ticketName}
              </p>
            )
          ) : (
            <p className="flex items-start gap-2 text-[15px] font-semibold text-expense">
              <XCircle size={22} className="shrink-0" />
              <span>
                {result.error}
                {result.attendee && <span className="block text-[13px] font-normal">{result.attendee}{result.at && ` · lúc ${new Date(result.at).toLocaleTimeString("vi-VN", { timeZone: "Asia/Ho_Chi_Minh" })}`}</span>}
              </span>
            </p>
          )}
        </div>
      )}
    </div>
  );
}

"use client";

import { Download, PlusSquare, Share, Smartphone } from "lucide-react";
import { useState } from "react";
import { BottomSheet, Button } from "@/ui";
import { usePwa } from "./PwaProvider";

/**
 * "Cài ứng dụng" card. Android/Chrome: native install prompt. iOS: Apple offers no
 * prompt API, so we show the Share → "Thêm vào MH chính" steps. Hidden once installed.
 */
export function InstallCard() {
  const { installMode, iosSafari, promptInstall } = usePwa();
  const [iosOpen, setIosOpen] = useState(false);

  if (installMode === "installed" || installMode === "unsupported") return null;

  return (
    <>
      <div className="flex items-center gap-3 rounded-[var(--radius-card)] border border-line bg-primary-soft p-4">
        <span className="grid size-11 shrink-0 place-items-center rounded-xl bg-primary text-on-primary">
          <Smartphone size={22} />
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-[15px] font-bold text-ink">Cài PFC lên điện thoại</p>
          <p className="text-[13px] text-ink-2">Mở toàn màn hình, nhanh hơn, nhận thông báo.</p>
        </div>
        <Button
          className="min-h-10 px-4 text-[14px]"
          onClick={() => (installMode === "native-prompt" ? void promptInstall() : setIosOpen(true))}
        >
          <Download size={16} /> Cài
        </Button>
      </div>

      <BottomSheet open={iosOpen} onClose={() => setIosOpen(false)} title="Thêm PFC vào màn hình chính">
        {!iosSafari && (
          <p className="mb-4 rounded-xl bg-warning-soft p-3 text-[14px] text-warning">
            Nếu không thấy mục &quot;Thêm vào MH chính&quot;, hãy mở trang này bằng Safari.
          </p>
        )}
        <ol className="space-y-4 text-[15px] text-ink">
          <li className="flex items-start gap-3">
            <span className="grid size-9 shrink-0 place-items-center rounded-full bg-primary-soft font-bold text-primary">1</span>
            <span className="pt-1.5">
              Bấm nút <Share size={18} className="inline align-text-bottom text-primary" aria-label="Chia sẻ" />{" "}
              <b>Chia sẻ</b> ở thanh dưới của Safari.
            </span>
          </li>
          <li className="flex items-start gap-3">
            <span className="grid size-9 shrink-0 place-items-center rounded-full bg-primary-soft font-bold text-primary">2</span>
            <span className="pt-1.5">
              Chọn <PlusSquare size={18} className="inline align-text-bottom text-primary" aria-hidden="true" />{" "}
              <b>Thêm vào MH chính</b> (Add to Home Screen).
            </span>
          </li>
          <li className="flex items-start gap-3">
            <span className="grid size-9 shrink-0 place-items-center rounded-full bg-primary-soft font-bold text-primary">3</span>
            <span className="pt-1.5">
              Bấm <b>Thêm</b>. Mở PFC từ biểu tượng mới trên màn hình chính.
            </span>
          </li>
        </ol>
      </BottomSheet>
    </>
  );
}

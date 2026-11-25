"use client";

import { BottomSheet } from "./BottomSheet";
import { Button } from "./Button";

/** Screen Inventory §5 delete/cancel confirmation, as a bottom sheet. */
export function ConfirmSheet({
  open,
  onClose,
  onConfirm,
  title,
  message,
  confirmLabel = "Xóa",
  danger = true,
  pending,
  error,
}: {
  open: boolean;
  onClose: () => void;
  onConfirm: () => void;
  title: string;
  message: string;
  confirmLabel?: string;
  danger?: boolean;
  pending?: boolean;
  error?: string | null;
}) {
  return (
    <BottomSheet
      open={open}
      onClose={onClose}
      title={title}
      footer={
        <div className="grid grid-cols-2 gap-3">
          <Button variant="secondary" onClick={onClose} disabled={pending}>
            Hủy
          </Button>
          <Button variant={danger ? "danger" : "primary"} onClick={onConfirm} disabled={pending}>
            {pending ? "Đang xử lý…" : confirmLabel}
          </Button>
        </div>
      }
    >
      <p className="text-[15px] leading-relaxed text-ink-2">{message}</p>
      {error && <p className="mt-3 text-[14px] font-medium text-expense">{error}</p>}
    </BottomSheet>
  );
}

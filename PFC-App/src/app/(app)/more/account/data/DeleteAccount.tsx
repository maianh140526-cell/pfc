"use client";

import { Trash2 } from "lucide-react";
import { useState } from "react";
import { deleteAccountAction } from "@/platform/account/actions";
import { BottomSheet, Button } from "@/ui";
import { FormError, PasswordInput, TextInput } from "@/ui/Form";

export function DeleteAccount({ email, hasPassword }: { email: string; hasPassword: boolean }) {
  const [open, setOpen] = useState(false);
  const [confirm, setConfirm] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  return (
    <>
      <button type="button" onClick={() => setOpen(true)} className="pressable flex w-full items-center gap-3 rounded-[var(--radius-card)] border border-line bg-surface p-4 text-left">
        <Trash2 size={26} className="shrink-0 text-expense" />
        <span>
          <span className="block text-[15px] font-semibold text-expense">Xóa tài khoản</span>
          <span className="block text-[13px] text-muted">Xóa dữ liệu cá nhân khỏi PFC. Không thể hoàn tác.</span>
        </span>
      </button>
      <BottomSheet
        open={open}
        onClose={() => setOpen(false)}
        title="Xóa tài khoản vĩnh viễn"
        footer={
          <Button
            variant="danger"
            block
            disabled={pending || confirm.trim().toLowerCase() !== email}
            onClick={async () => {
              setPending(true);
              setError(null);
              try {
                const r = await deleteAccountAction({ confirm, password });
                if (r && !r.ok) setError(r.error);
              } catch (err) {
                if (err && typeof err === "object" && "digest" in err) throw err;
                setError("Không kết nối được máy chủ.");
              } finally {
                setPending(false);
              }
            }}
          >
            Xóa vĩnh viễn
          </Button>
        }
      >
        <div className="space-y-3 text-[14px] text-ink-2">
          <ul className="list-disc space-y-1 pl-5">
            <li>Xóa: hồ sơ, dữ liệu tài chính, tiến độ học, giỏ hàng, yêu thích, thông báo, thiết bị, liên kết đăng nhập.</li>
            <li>Giữ lại nhưng ẩn tên (“Tài khoản đã xóa”): đơn hàng đã xong, đánh giá, bài diễn đàn, lịch sử dự án — vì người khác cần các bản ghi này.</li>
            <li>Cần hoàn tất đơn hàng và dự án đang chạy trước khi xóa.</li>
          </ul>
          <TextInput label={`Nhập email của bạn (${email}) để xác nhận`} type="email" autoCapitalize="none" value={confirm} onChange={(e) => setConfirm(e.target.value)} />
          {hasPassword && <PasswordInput label="Mật khẩu" autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} />}
          <FormError message={error} />
        </div>
      </BottomSheet>
    </>
  );
}

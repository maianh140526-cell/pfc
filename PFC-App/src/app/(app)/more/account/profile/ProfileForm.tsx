"use client";

import { Camera, Loader2, Mail, Trash2 } from "lucide-react";
import { useRef, useState } from "react";
import type { Profile } from "@/platform/account/service";
import { requestEmailChangeAction, setAvatarAction, updateProfileAction } from "@/platform/account/actions";
import { BottomSheet, Button, Section } from "@/ui";
import { Avatar } from "@/ui/Avatar";
import { FormError, PasswordInput, TextArea, TextInput } from "@/ui/Form";
import { cx } from "@/ui/cx";
import { useAction } from "@/ui/use-action";

export function ProfileForm({ profile }: { profile: Profile }) {
  const [v, setV] = useState({
    fullName: profile.fullName,
    birthDate: profile.birthDate ?? "",
    gender: profile.gender ?? "",
    phone: profile.phone ?? "",
    address: profile.address ?? "",
    bio: profile.bio,
  });
  const save = useAction();
  const [saved, setSaved] = useState(false);
  const set = (k: keyof typeof v) => (e: { target: { value: string } }) => setV((x) => ({ ...x, [k]: e.target.value }));

  return (
    <>
      <AvatarEditor name={profile.fullName} url={profile.avatarUrl} />
      <form
        className="space-y-4 px-4 pt-2"
        noValidate
        onSubmit={(e) => {
          e.preventDefault();
          setSaved(false);
          save.run(() => updateProfileAction(v), () => setSaved(true));
        }}
      >
        <TextInput label="Họ và tên" value={v.fullName} onChange={set("fullName")} autoComplete="name" maxLength={80} />
        <TextInput label="Ngày sinh" type="date" value={v.birthDate} onChange={set("birthDate")} max={new Date().toISOString().slice(0, 10)} />
        <fieldset>
          <legend className="mb-1.5 text-[14px] font-semibold text-ink">Giới tính</legend>
          <div className="flex gap-2" role="radiogroup">
            {(
              [
                ["female", "Nữ"],
                ["male", "Nam"],
                ["other", "Khác"],
              ] as const
            ).map(([val, label]) => (
              <label
                key={val}
                className={cx(
                  "flex min-h-11 flex-1 cursor-pointer items-center justify-center rounded-[var(--radius-control)] border text-[14px] font-semibold",
                  v.gender === val ? "border-primary bg-primary-soft text-primary" : "border-line bg-surface text-ink-2",
                )}
              >
                <input type="radio" name="gender" value={val} checked={v.gender === val} onChange={set("gender")} className="sr-only" />
                {label}
              </label>
            ))}
          </div>
        </fieldset>
        <TextInput label="Số điện thoại" type="tel" inputMode="tel" autoComplete="tel" value={v.phone} onChange={set("phone")} placeholder="0903 123 456" />
        <EmailRow email={profile.email} hasPassword={profile.hasPassword} />
        <TextInput label="Địa chỉ" value={v.address} onChange={set("address")} autoComplete="street-address" maxLength={200} />
        <TextArea label="Giới thiệu bản thân" value={v.bio} onChange={set("bio")} maxLength={500} />
        <FormError message={save.error} />
        {saved && <p className="text-[14px] font-semibold text-income" role="status">Đã lưu thay đổi.</p>}
        <Button type="submit" block disabled={save.pending}>
          {save.pending ? "Đang lưu…" : "Lưu thay đổi"}
        </Button>
      </form>
    </>
  );
}

function AvatarEditor({ name, url }: { name: string; url: string | null }) {
  const input = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const a = useAction();

  async function pick(files: FileList | null) {
    const f = files?.[0];
    if (!f) return;
    setError(null);
    setBusy(true);
    try {
      const body = new FormData();
      body.set("purpose", "avatar");
      body.set("file", f);
      const res = await fetch("/api/uploads", { method: "POST", body });
      const data = (await res.json().catch(() => ({}))) as { url?: string; error?: string };
      if (!res.ok || !data.url) setError(data.error ?? "Không tải được ảnh.");
      else a.run(() => setAvatarAction(data.url!));
    } catch {
      setError("Không kết nối được máy chủ.");
    } finally {
      setBusy(false);
      if (input.current) input.current.value = "";
    }
  }

  return (
    <Section>
      <div className="flex flex-col items-center gap-2">
        <div className="relative">
          <Avatar name={name} url={url} size={96} />
          <label className="absolute right-0 bottom-0 grid size-9 cursor-pointer place-items-center rounded-full border-2 border-bg bg-primary text-on-primary" aria-label="Đổi ảnh đại diện">
            {busy || a.pending ? <Loader2 size={16} className="animate-spin" /> : <Camera size={16} />}
            <input ref={input} type="file" accept="image/jpeg,image/png,image/webp" className="sr-only" onChange={(e) => pick(e.target.files)} />
          </label>
        </div>
        {url && (
          <button type="button" className="flex items-center gap-1 text-[13px] font-semibold text-expense" disabled={a.pending} onClick={() => a.run(() => setAvatarAction(null))}>
            <Trash2 size={14} /> Gỡ ảnh
          </button>
        )}
        {(error || a.error) && (
          <p className="text-[13px] text-expense" role="alert">
            {error || a.error}
          </p>
        )}
        <p className="text-[12px] text-muted">Ảnh được cắt vuông và xóa thông tin vị trí trước khi lưu.</p>
      </div>
    </Section>
  );
}

function EmailRow({ email, hasPassword }: { email: string; hasPassword: boolean }) {
  const [open, setOpen] = useState(false);
  const [next, setNext] = useState("");
  const [password, setPassword] = useState("");
  const [sentTo, setSentTo] = useState<string | null>(null);
  const a = useAction();
  return (
    <div>
      <p className="mb-1.5 text-[14px] font-semibold text-ink">Email</p>
      <div className="flex min-h-12 items-center gap-2 rounded-[var(--radius-control)] border border-line bg-surface-2 px-3">
        <Mail size={18} className="shrink-0 text-muted" />
        <span className="min-w-0 flex-1 truncate text-[15px] text-ink-2">{email}</span>
        <button type="button" onClick={() => setOpen(true)} className="min-h-11 shrink-0 text-[14px] font-semibold text-primary">
          Đổi
        </button>
      </div>
      {sentTo && <p className="mt-1.5 text-[13px] text-income">Đã gửi liên kết xác nhận tới {sentTo}. Email chỉ đổi sau khi bạn bấm liên kết đó.</p>}
      <BottomSheet
        open={open}
        onClose={() => setOpen(false)}
        title="Đổi email"
        footer={
          <Button
            block
            disabled={a.pending}
            onClick={() =>
              a.run(
                () => requestEmailChangeAction({ email: next, password }),
                () => {
                  setSentTo(next.trim().toLowerCase());
                  setOpen(false);
                  setPassword("");
                },
              )
            }
          >
            Gửi liên kết xác nhận
          </Button>
        }
      >
        <div className="space-y-3">
          <TextInput label="Email mới" type="email" inputMode="email" autoCapitalize="none" value={next} onChange={(e) => setNext(e.target.value)} />
          {hasPassword && <PasswordInput label="Mật khẩu hiện tại" autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} />}
          <p className="text-[12px] text-muted">PFC gửi liên kết tới email mới (hiệu lực 1 giờ) và báo cho email cũ để bảo vệ tài khoản.</p>
          <FormError message={a.error} />
        </div>
      </BottomSheet>
    </div>
  );
}

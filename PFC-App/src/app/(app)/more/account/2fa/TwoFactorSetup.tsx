"use client";

import { Check, Copy, KeyRound, ShieldCheck } from "lucide-react";
import { useState } from "react";
import { confirmTwoFactorAction, disableTwoFactorAction, startTwoFactorAction } from "@/platform/account/actions";
import { BottomSheet, Button, Card, Section } from "@/ui";
import { FormError, PasswordInput, TextInput } from "@/ui/Form";
import { useAction } from "@/ui/use-action";

const STEPS = [
  { title: "Tải ứng dụng xác thực", text: "Google Authenticator, Microsoft Authenticator hoặc Authy." },
  { title: "Quét mã QR", text: "Mở ứng dụng, chọn thêm tài khoản và quét mã bên dưới." },
  { title: "Nhập mã xác thực", text: "Nhập mã 6 số đang hiện trong ứng dụng để hoàn tất." },
];

export function TwoFactorSetup({ enabled, backupLeft, hasPassword }: { enabled: boolean; backupLeft: number; hasPassword: boolean }) {
  const a = useAction();
  const [setup, setSetup] = useState<{ secret: string; qr: string } | null>(null);
  const [code, setCode] = useState("");
  const [codes, setCodes] = useState<string[] | null>(null);
  const [off, setOff] = useState(false);

  if (codes) return <BackupCodes codes={codes} />;

  return (
    <>
      <div className="flex flex-col items-center px-4 pt-2 text-center">
        <span className="grid size-16 place-items-center rounded-full bg-primary-soft text-primary">
          <ShieldCheck size={30} />
        </span>
        <p className="mt-3 text-[17px] font-bold text-ink">Tăng cường bảo mật</p>
        <p className="text-[14px] text-muted">Khi đăng nhập, bạn cần nhập thêm mã từ ứng dụng xác thực trên điện thoại.</p>
      </div>

      {enabled ? (
        <Section>
          <Card className="p-4">
            <p className="flex items-center gap-2 text-[15px] font-bold text-income">
              <Check size={18} /> Đang bật
            </p>
            <p className="mt-1 text-[14px] text-ink-2">Còn {backupLeft} mã dự phòng chưa dùng. Mỗi mã dùng được một lần khi bạn mất điện thoại.</p>
            <Button variant="secondary" block className="mt-3 text-expense" onClick={() => setOff(true)}>
              Tắt xác thực hai lớp
            </Button>
          </Card>
          <DisableSheet open={off} onClose={() => setOff(false)} hasPassword={hasPassword} />
        </Section>
      ) : (
        <Section>
          <ol className="space-y-4">
            {STEPS.map((s, i) => (
              <li key={s.title} className="flex gap-3">
                <span className="grid size-8 shrink-0 place-items-center rounded-full bg-primary text-[14px] font-bold text-on-primary">{i + 1}</span>
                <span>
                  <span className="block text-[15px] font-semibold text-ink">{s.title}</span>
                  <span className="block text-[13px] text-muted">{s.text}</span>
                  {i === 1 && setup && (
                    <span className="mt-3 block">
                      {/* eslint-disable-next-line @next/next/no-img-element -- QR generated on our server */}
                      <img src={setup.qr} alt="Mã QR để thêm PFC vào ứng dụng xác thực" width={176} height={176} className="rounded-xl border border-line bg-white p-2" />
                      <span className="mt-2 block text-[12px] text-muted">Không quét được? Nhập khóa thủ công:</span>
                      <code className="mt-1 block rounded-lg bg-surface-2 px-2 py-1.5 text-[13px] break-all text-ink select-all">{setup.secret.match(/.{1,4}/g)?.join(" ")}</code>
                    </span>
                  )}
                </span>
              </li>
            ))}
          </ol>
          <div className="mt-4">
            {!setup ? (
              <Button block disabled={a.pending} onClick={() => a.run(() => startTwoFactorAction(), (d) => setSetup(d))}>
                Bắt đầu bật xác thực hai lớp
              </Button>
            ) : (
              <form
                className="flex gap-2"
                onSubmit={(e) => {
                  e.preventDefault();
                  a.run(() => confirmTwoFactorAction(code), (c) => setCodes(c));
                }}
              >
                <div className="flex-1">
                  <TextInput label="Mã 6 số" inputMode="numeric" autoComplete="one-time-code" maxLength={7} value={code} onChange={(e) => setCode(e.target.value)} placeholder="123456" />
                </div>
                <Button type="submit" className="mt-[26px]" disabled={a.pending || code.replace(/\s/g, "").length !== 6}>
                  Xác nhận
                </Button>
              </form>
            )}
            <FormError message={a.error} />
          </div>
        </Section>
      )}
    </>
  );
}

function BackupCodes({ codes }: { codes: string[] }) {
  const [copied, setCopied] = useState(false);
  return (
    <Section>
      <Card className="p-4">
        <p className="flex items-center gap-2 text-[16px] font-bold text-income">
          <Check size={20} /> Đã bật xác thực hai lớp
        </p>
        <p className="mt-2 text-[14px] text-ink-2">
          <b>Lưu lại 8 mã dự phòng</b> ở nơi an toàn. Khi mất điện thoại, mỗi mã đăng nhập được một lần. PFC sẽ không hiện lại các mã này.
        </p>
        <ul className="mt-3 grid grid-cols-2 gap-2 font-mono text-[15px]">
          {codes.map((c) => (
            <li key={c} className="flex items-center gap-1.5 rounded-lg bg-surface-2 px-2 py-1.5 text-ink">
              <KeyRound size={14} className="text-muted" /> {c}
            </li>
          ))}
        </ul>
        <Button
          variant="secondary"
          block
          className="mt-3"
          onClick={async () => {
            await navigator.clipboard?.writeText(codes.join("\n")).catch(() => undefined);
            setCopied(true);
          }}
        >
          <Copy size={16} /> {copied ? "Đã sao chép" : "Sao chép các mã"}
        </Button>
        <a href="/more/account" className="mt-2 block text-center text-[14px] font-semibold text-primary">
          Tôi đã lưu, quay lại
        </a>
      </Card>
    </Section>
  );
}

function DisableSheet({ open, onClose, hasPassword }: { open: boolean; onClose: () => void; hasPassword: boolean }) {
  const [password, setPassword] = useState("");
  const [code, setCode] = useState("");
  const a = useAction();
  return (
    <BottomSheet
      open={open}
      onClose={onClose}
      title="Tắt xác thực hai lớp"
      footer={
        <Button variant="danger" block disabled={a.pending} onClick={() => a.run(() => disableTwoFactorAction({ password, code }), onClose)}>
          Tắt 2FA
        </Button>
      }
    >
      <div className="space-y-3">
        {hasPassword && <PasswordInput label="Mật khẩu" autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} />}
        <TextInput label="Mã 6 số hoặc mã dự phòng" autoComplete="one-time-code" value={code} onChange={(e) => setCode(e.target.value)} />
        <p className="text-[12px] text-muted">Tài khoản sẽ chỉ còn bảo vệ bằng mật khẩu.</p>
        <FormError message={a.error} />
      </div>
    </BottomSheet>
  );
}

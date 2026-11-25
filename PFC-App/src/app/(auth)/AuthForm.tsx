"use client";

import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { AlertTriangle, Check, CheckCircle2, Circle, Clock, Loader2, Lock, MailCheck } from "lucide-react";
import { useEffect, useState, useTransition } from "react";
import { loginAction, registerAction, resendVerificationAction } from "@/platform/auth/actions";
import { PASSWORD_RULES } from "@/platform/auth/password-policy";
import { Button } from "@/ui";
import { FormError, PasswordInput, TextInput } from "@/ui/Form";
import { SegmentedTabs } from "@/ui/SegmentedTabs";
import { cx } from "@/ui/cx";
import { SocialButtons } from "./SocialButtons";

type Failure = { error: string; code?: string; meta?: Record<string, string | number> };
export type AuthNotice = { tone: "success" | "error"; text: string } | null;

const isRedirect = (err: unknown) => !!err && typeof err === "object" && "digest" in err;
const NETWORK = "Không kết nối được máy chủ. Kiểm tra mạng và thử lại.";

/** SYS-02 Login / SYS-03 Register (mockups 2–3, 95–96): tabs, Google / Facebook, email + password. */
export function AuthForm({
  mode,
  next,
  providers,
  notice,
}: {
  mode: "login" | "register";
  next?: string;
  providers: { google: boolean; facebook: boolean };
  notice?: AuthNotice;
}) {
  const router = useRouter();
  const register = mode === "register";
  const nextQuery = next ? `?next=${encodeURIComponent(next)}` : "";
  const [remember, setRemember] = useState(true);

  return (
    <div className="mx-auto flex w-full max-w-sm flex-1 flex-col">
      <Link href="/home" className="mx-auto mb-5 flex items-center gap-2" aria-label="Về trang chủ PFC">
        <Image src="/brand/pfc-mark.png" alt="" width={44} height={44} className="rounded-xl" priority />
        <span className="text-2xl font-extrabold text-primary">PFC</span>
      </Link>
      <h1 className="text-center text-[26px] font-extrabold text-ink">{register ? "Tạo tài khoản" : "Chào mừng trở lại!"}</h1>
      <p className="mt-1 mb-5 text-center text-[15px] text-muted">
        {register ? "Tham gia cộng đồng PFC ngay hôm nay" : "Đăng nhập để tiếp tục hành trình tài chính của bạn"}
      </p>

      <SegmentedTabs
        label="Đăng nhập hoặc đăng ký"
        stretch
        value={mode}
        onChange={(m) => router.replace(`/${m}${nextQuery}`, { scroll: false })}
        options={[
          { value: "login", label: "Đăng nhập" },
          { value: "register", label: "Đăng ký" },
        ]}
      />

      {notice && (
        <p
          role={notice.tone === "error" ? "alert" : "status"}
          className={cx(
            "mt-4 flex gap-2 rounded-2xl p-3 text-[14px]",
            notice.tone === "error" ? "bg-expense-soft text-expense" : "bg-income-soft text-income",
          )}
        >
          {notice.tone === "error" ? <AlertTriangle size={18} className="mt-0.5 shrink-0" /> : <CheckCircle2 size={18} className="mt-0.5 shrink-0" />}
          <span>{notice.text}</span>
        </p>
      )}

      <div className="mt-5">
        <SocialButtons providers={providers} next={next} remember={remember} register={register} />
        {register && (
          <p className="mt-2 text-center text-[12px] text-muted">
            Đăng ký bằng Google/Facebook nghĩa là bạn đồng ý{" "}
            <Link href="/more/policies/terms" className="font-semibold text-primary">
              Điều khoản
            </Link>{" "}
            và{" "}
            <Link href="/more/policies/privacy" className="font-semibold text-primary">
              Chính sách quyền riêng tư
            </Link>
            .
          </p>
        )}
      </div>
      <div className="my-5 flex items-center gap-3 text-[13px] text-muted" aria-hidden="true">
        <span className="h-px flex-1 bg-line" /> hoặc dùng email <span className="h-px flex-1 bg-line" />
      </div>

      {register ? <RegisterForm next={next} /> : <LoginForm next={next} remember={remember} setRemember={setRemember} />}

      <p className="mt-auto pt-8 text-center text-[14px] text-muted">
        {register ? "Đã có tài khoản? " : "Chưa có tài khoản? "}
        <Link href={`${register ? "/login" : "/register"}${nextQuery}`} className="font-semibold text-primary">
          {register ? "Đăng nhập" : "Đăng ký ngay"}
        </Link>
      </p>
    </div>
  );
}

function LoginForm({ next, remember, setRemember }: { next?: string; remember: boolean; setRemember: (b: boolean) => void }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [fieldErr, setFieldErr] = useState<{ email?: string; password?: string }>({});
  const [failure, setFailure] = useState<Failure | null>(null);
  const [pending, start] = useTransition();
  const waitSec = useCountdown(failure?.code === "rate_limited" ? Number(failure.meta?.retryAfterSec ?? 0) : 0);
  const blocked = failure?.code === "rate_limited" && waitSec > 0;

  function submit(e: React.FormEvent) {
    e.preventDefault();
    const fe: typeof fieldErr = {};
    if (!email.trim()) fe.email = "Vui lòng nhập email.";
    else if (!/^\S+@\S+\.\S+$/.test(email.trim())) fe.email = "Email không hợp lệ.";
    if (!password) fe.password = "Vui lòng nhập mật khẩu.";
    setFieldErr(fe);
    if (fe.email || fe.password) return;
    setFailure(null);
    start(async () => {
      try {
        const res = await loginAction({ email, password, remember }, next);
        if (res && !res.ok) setFailure(res);
      } catch (err) {
        if (isRedirect(err)) throw err;
        setFailure({ error: NETWORK });
      }
    });
  }

  return (
    <form onSubmit={submit} className="space-y-4" noValidate aria-busy={pending}>
      <fieldset disabled={pending} className="space-y-4">
        <TextInput
          label="Email"
          type="email"
          inputMode="email"
          autoComplete="email"
          autoCapitalize="none"
          placeholder="ban@email.com"
          value={email}
          error={fieldErr.email}
          onChange={(e) => {
            setEmail(e.target.value);
            setFieldErr((f) => ({ ...f, email: undefined }));
          }}
        />
        <PasswordInput
          label="Mật khẩu"
          autoComplete="current-password"
          value={password}
          error={fieldErr.password}
          onChange={(e) => {
            setPassword(e.target.value);
            setFieldErr((f) => ({ ...f, password: undefined }));
          }}
        />
        <div className="flex items-center justify-between gap-3">
          <label className="flex min-h-11 items-center gap-2.5 text-[14px] text-ink-2">
            <input type="checkbox" checked={remember} onChange={(e) => setRemember(e.target.checked)} className="size-5 accent-[var(--pfc-primary)]" />
            Ghi nhớ đăng nhập
          </label>
          <Link href={`/forgot-password${email.trim() ? `?email=${encodeURIComponent(email.trim())}` : ""}`} className="min-h-11 content-center text-[14px] font-semibold text-primary">
            Quên mật khẩu?
          </Link>
        </div>
      </fieldset>

      {failure && <LoginFailure failure={failure} waitSec={waitSec} email={email} />}

      <Button type="submit" block disabled={pending || blocked}>
        {pending ? (
          <>
            <Loader2 size={18} className="animate-spin" /> Đang đăng nhập…
          </>
        ) : blocked ? (
          `Thử lại sau ${fmt(waitSec)}`
        ) : (
          "Đăng nhập"
        )}
      </Button>
    </form>
  );
}

function LoginFailure({ failure, waitSec, email }: { failure: Failure; waitSec: number; email: string }) {
  if (failure.code === "rate_limited") {
    return (
      <StateCard icon={Clock} tone="warning" title="Tạm khóa đăng nhập">
        {waitSec > 0 ? `Quá nhiều lần thử sai. Bạn có thể thử lại sau ${fmt(waitSec)}.` : "Bạn có thể thử đăng nhập lại."} Quên mật khẩu? Hãy đặt lại mật khẩu.
      </StateCard>
    );
  }
  if (failure.code === "locked") {
    return (
      <StateCard icon={Lock} tone="expense" title="Tài khoản đã bị khóa">
        {failure.error}
      </StateCard>
    );
  }
  if (failure.code === "unverified") return <UnverifiedCard email={String(failure.meta?.email ?? email)} message={failure.error} />;
  return <FormError message={failure.error} />;
}

function UnverifiedCard({ email, message }: { email: string; message: string }) {
  const [state, setState] = useState<"idle" | "sent" | string>("idle");
  const [pending, start] = useTransition();
  return (
    <StateCard icon={MailCheck} tone="warning" title="Email chưa được xác thực">
      {message}
      <button
        type="button"
        disabled={pending || state === "sent"}
        className="mt-2 block font-semibold text-primary disabled:opacity-60"
        onClick={() =>
          start(async () => {
            const r = await resendVerificationAction(email).catch(() => ({ ok: false as const, error: NETWORK }));
            setState(r.ok ? "sent" : r.error);
          })
        }
      >
        {pending ? "Đang gửi…" : state === "sent" ? "Đã gửi lại thư xác thực ✓" : "Gửi lại thư xác thực"}
      </button>
      {state !== "idle" && state !== "sent" && <span className="mt-1 block text-expense">{state}</span>}
    </StateCard>
  );
}

function RegisterForm({ next }: { next?: string }) {
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [agree, setAgree] = useState(false);
  const [failure, setFailure] = useState<Failure | null>(null);
  const [sentTo, setSentTo] = useState<string | null>(null);
  const [pending, start] = useTransition();

  if (sentTo) {
    return (
      <div className="space-y-3 text-center">
        <MailCheck size={44} className="mx-auto text-primary" />
        <p className="text-[18px] font-bold text-ink">Kiểm tra hộp thư của bạn</p>
        <p className="text-[14px] text-ink-2">
          PFC đã gửi liên kết xác thực tới <b>{sentTo}</b>. Mở thư và bấm liên kết (hiệu lực 24 giờ), sau đó đăng nhập.
        </p>
        <UnverifiedCard email={sentTo} message="Không thấy thư? Kiểm tra mục Spam/Quảng cáo." />
      </div>
    );
  }

  function submit(e: React.FormEvent) {
    e.preventDefault();
    setFailure(null);
    start(async () => {
      try {
        const res = await registerAction({ fullName, email, password, agree }, next);
        if (!res) return;
        if (!res.ok) setFailure(res);
        else if (res.data.mustVerify) setSentTo(email.trim().toLowerCase());
      } catch (err) {
        if (isRedirect(err)) throw err;
        setFailure({ error: NETWORK });
      }
    });
  }

  return (
    <form onSubmit={submit} className="space-y-4" noValidate aria-busy={pending}>
      <fieldset disabled={pending} className="space-y-4">
        <TextInput label="Họ và tên" value={fullName} onChange={(e) => setFullName(e.target.value)} autoComplete="name" />
        <TextInput label="Email" type="email" inputMode="email" autoComplete="email" autoCapitalize="none" value={email} onChange={(e) => setEmail(e.target.value)} />
        <PasswordInput label="Mật khẩu" autoComplete="new-password" value={password} onChange={(e) => setPassword(e.target.value)} />
        <ul className="space-y-1 text-[13px]">
          {PASSWORD_RULES.map((r) => {
            const ok = r.test(password);
            return (
              <li key={r.id} className={cx("flex items-center gap-2", ok ? "text-income" : "text-muted")}>
                {ok ? <Check size={15} /> : <Circle size={15} />} {r.label}
              </li>
            );
          })}
        </ul>
        <label className="flex items-start gap-3 text-[14px] text-ink-2">
          <input type="checkbox" checked={agree} onChange={(e) => setAgree(e.target.checked)} className="mt-0.5 size-5 shrink-0 accent-[var(--pfc-primary)]" />
          <span>
            Tôi đồng ý với{" "}
            <Link href="/more/policies/terms" target="_blank" className="font-semibold text-primary">
              Điều khoản sử dụng
            </Link>{" "}
            và{" "}
            <Link href="/more/policies/privacy" target="_blank" className="font-semibold text-primary">
              Chính sách quyền riêng tư
            </Link>{" "}
            của PFC.
          </span>
        </label>
      </fieldset>
      {failure?.code === "exists" ? (
        <StateCard icon={AlertTriangle} tone="warning" title="Email đã có tài khoản">
          <Link href={`/login${next ? `?next=${encodeURIComponent(next)}` : ""}`} className="font-semibold text-primary">
            Đăng nhập
          </Link>{" "}
          hoặc dùng “Quên mật khẩu?” nếu bạn không nhớ.
        </StateCard>
      ) : (
        <FormError message={failure?.error} />
      )}
      <Button type="submit" block disabled={pending}>
        {pending ? (
          <>
            <Loader2 size={18} className="animate-spin" /> Đang tạo tài khoản…
          </>
        ) : (
          "Tạo tài khoản"
        )}
      </Button>
    </form>
  );
}

export function StateCard({
  icon: Icon,
  tone,
  title,
  children,
}: {
  icon: typeof Clock;
  tone: "warning" | "expense" | "income";
  title: string;
  children: React.ReactNode;
}) {
  const tones = { warning: "bg-warning-soft text-ink", expense: "bg-expense-soft text-ink", income: "bg-income-soft text-ink" } as const;
  const iconTone = { warning: "text-warning", expense: "text-expense", income: "text-income" } as const;
  return (
    <div role="alert" className={cx("flex gap-3 rounded-2xl p-3.5 text-[14px]", tones[tone])}>
      <Icon size={20} className={cx("mt-0.5 shrink-0", iconTone[tone])} />
      <div>
        <p className="font-bold">{title}</p>
        <div className="mt-0.5 text-ink-2">{children}</div>
      </div>
    </div>
  );
}

function useCountdown(seconds: number): number {
  const [left, setLeft] = useState(seconds);
  useEffect(() => {
    setLeft(seconds);
    if (seconds <= 0) return;
    const end = Date.now() + seconds * 1000;
    const t = setInterval(() => {
      const s = Math.max(0, Math.ceil((end - Date.now()) / 1000));
      setLeft(s);
      if (s === 0) clearInterval(t);
    }, 1000);
    return () => clearInterval(t);
  }, [seconds]);
  return left;
}

const fmt = (s: number) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;

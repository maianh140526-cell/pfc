"use client";

import { Eye, EyeOff } from "lucide-react";
import { useId, useState, type ComponentProps, type ReactNode } from "react";
import { cx } from "./cx";

const control =
  "w-full rounded-[var(--radius-control)] border border-line bg-surface px-4 py-3 text-[16px] text-ink outline-none placeholder:text-muted focus:border-primary disabled:opacity-60";

export function Field({
  label,
  hint,
  error,
  children,
  htmlFor,
}: {
  label: string;
  hint?: string;
  error?: string | null;
  children: ReactNode;
  htmlFor?: string;
}) {
  return (
    <div>
      <label htmlFor={htmlFor} className="mb-1.5 block text-[13px] font-semibold text-ink-2">
        {label}
      </label>
      {children}
      {error ? (
        <p className="mt-1 text-[13px] font-medium text-expense" role="alert">
          {error}
        </p>
      ) : hint ? (
        <p className="mt-1 text-[12px] text-muted">{hint}</p>
      ) : null}
    </div>
  );
}

export function TextInput({ label, hint, error, className, ...rest }: ComponentProps<"input"> & { label: string; hint?: string; error?: string | null }) {
  const id = useId();
  return (
    <Field label={label} hint={hint} error={error} htmlFor={id}>
      <input id={id} className={cx(control, className)} aria-invalid={error ? true : undefined} {...rest} />
    </Field>
  );
}

export function PasswordInput({ label, error, hint, ...rest }: ComponentProps<"input"> & { label: string; hint?: string; error?: string | null }) {
  const id = useId();
  const [show, setShow] = useState(false);
  return (
    <Field label={label} hint={hint} error={error} htmlFor={id}>
      <div className="relative">
        <input id={id} type={show ? "text" : "password"} className={cx(control, "pr-12")} {...rest} />
        <button
          type="button"
          onClick={() => setShow((s) => !s)}
          aria-label={show ? "Ẩn mật khẩu" : "Hiện mật khẩu"}
          className="absolute top-1/2 right-1 grid size-10 -translate-y-1/2 place-items-center rounded-full text-muted"
        >
          {show ? <EyeOff size={20} /> : <Eye size={20} />}
        </button>
      </div>
    </Field>
  );
}

export function TextArea({
  label,
  hint,
  error,
  maxLength,
  value,
  ...rest
}: ComponentProps<"textarea"> & { label: string; hint?: string; error?: string | null }) {
  const id = useId();
  const len = typeof value === "string" ? value.length : 0;
  return (
    <Field label={label} hint={hint} error={error} htmlFor={id}>
      <textarea id={id} rows={3} maxLength={maxLength} value={value} className={cx(control, "resize-none")} {...rest} />
      {maxLength && (
        <p className="mt-1 text-right text-[12px] text-muted">
          {len}/{maxLength}
        </p>
      )}
    </Field>
  );
}

export function SelectInput({
  label,
  error,
  children,
  ...rest
}: ComponentProps<"select"> & { label: string; error?: string | null }) {
  const id = useId();
  return (
    <Field label={label} error={error} htmlFor={id}>
      <select id={id} className={cx(control, "appearance-none")} {...rest}>
        {children}
      </select>
    </Field>
  );
}

export function FormError({ message }: { message?: string | null }) {
  if (!message) return null;
  return (
    <p role="alert" className="rounded-xl bg-expense-soft px-4 py-3 text-[14px] font-medium text-expense">
      {message}
    </p>
  );
}

export function Toggle({
  checked,
  onChange,
  label,
  description,
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
  label: string;
  description?: string;
}) {
  return (
    <label className="flex min-h-14 cursor-pointer items-center gap-3">
      <span className="flex-1">
        <span className="block text-[15px] font-semibold text-ink">{label}</span>
        {description && <span className="block text-[13px] text-muted">{description}</span>}
      </span>
      <input type="checkbox" className="peer sr-only" checked={checked} onChange={(e) => onChange(e.target.checked)} />
      <span
        aria-hidden="true"
        className="relative h-7 w-12 rounded-full bg-line transition-colors peer-checked:bg-primary peer-focus-visible:outline-2 peer-focus-visible:outline-primary after:absolute after:top-1 after:left-1 after:size-5 after:rounded-full after:bg-white after:transition-transform peer-checked:after:translate-x-5"
      />
    </label>
  );
}

import Link from "next/link";
import type { ComponentProps, ReactNode } from "react";
import { cx } from "./cx";

type Variant = "primary" | "secondary" | "ghost" | "danger";

const base =
  "pressable inline-flex min-h-12 items-center justify-center gap-2 rounded-[var(--radius-control)] px-5 text-[15px] font-semibold disabled:pointer-events-none disabled:opacity-45";
const variants: Record<Variant, string> = {
  primary: "bg-primary text-on-primary shadow-card active:bg-primary-press",
  secondary: "border border-primary bg-surface text-primary",
  ghost: "text-primary",
  danger: "bg-expense text-on-primary",
};

export function buttonClass(variant: Variant = "primary", block = false) {
  return cx(base, variants[variant], block && "w-full");
}

export function Button({
  variant = "primary",
  block,
  className,
  ...rest
}: ComponentProps<"button"> & { variant?: Variant; block?: boolean }) {
  return <button type="button" className={cx(buttonClass(variant, block), className)} {...rest} />;
}

export function ButtonLink({
  href,
  variant = "primary",
  block,
  children,
}: {
  href: string;
  variant?: Variant;
  block?: boolean;
  children: ReactNode;
}) {
  return (
    <Link href={href} className={buttonClass(variant, block)}>
      {children}
    </Link>
  );
}

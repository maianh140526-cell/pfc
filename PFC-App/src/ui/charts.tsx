"use client";

import { useState } from "react";
import { formatVnd } from "@/lib/money";
import { cx } from "./cx";

/**
 * Small, dependency-free charts that follow the dataviz skill:
 * categorical colours in fixed order (never cycled; tail folded into "Khác"), legend with
 * text-coloured values, 2px surface gaps between segments, recessive axes, hover/tap tooltips,
 * and an accessible table fallback (sr-only).
 */

/** Reference categorical palette (dataviz references/palette.md), light / dark steps. */
const SERIES = [
  ["#2a78d6", "#3987e5"],
  ["#eb6834", "#d95926"],
  ["#1baf7a", "#199e70"],
  ["#eda100", "#c98500"],
  ["#e87ba4", "#d55181"],
] as const;
const OTHER = ["#a3a1b5", "#5c5a70"] as const;

export function seriesColor(index: number, isOther: boolean): string {
  const pair = isOther ? OTHER : SERIES[Math.min(index, SERIES.length - 1)];
  return `light-dark(${pair[0]}, ${pair[1]})`;
}

export type DonutSlice = { key: string; label: string; amount: number; share: number; isOther?: boolean };

export function DonutChart({
  slices,
  centerLabel,
  centerValue,
  size = 168,
}: {
  slices: readonly DonutSlice[];
  centerLabel: string;
  centerValue: string;
  size?: number;
}) {
  const [active, setActive] = useState<string | null>(null);
  const stroke = 22;
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const gap = slices.length > 1 ? 2 : 0; // px of surface between segments
  let offset = 0;
  const focus = slices.find((s) => s.key === active);

  return (
    <div className="flex flex-col items-center gap-4 sm:flex-row">
      <div className="relative shrink-0" style={{ width: size, height: size }}>
        <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} role="img" aria-label={`${centerLabel}: ${centerValue}`}>
          <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="var(--pfc-surface-2)" strokeWidth={stroke} />
          {slices.map((s, i) => {
            const len = Math.max(0, s.share * c - gap);
            const el = (
              <circle
                key={s.key}
                cx={size / 2}
                cy={size / 2}
                r={r}
                fill="none"
                stroke={seriesColor(i, !!s.isOther)}
                strokeWidth={active === s.key ? stroke + 4 : stroke}
                strokeDasharray={`${len} ${c - len}`}
                strokeDashoffset={-offset}
                transform={`rotate(-90 ${size / 2} ${size / 2})`}
                onPointerEnter={() => setActive(s.key)}
                onPointerLeave={() => setActive(null)}
                onClick={() => setActive((a) => (a === s.key ? null : s.key))}
                style={{ cursor: "pointer", transition: "stroke-width 120ms" }}
              />
            );
            offset += s.share * c;
            return el;
          })}
        </svg>
        <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center px-6 text-center">
          <span className="text-[12px] text-muted">{focus ? focus.label : centerLabel}</span>
          <span className="text-[17px] leading-tight font-extrabold text-ink">
            {focus ? formatVnd(focus.amount) : centerValue}
          </span>
          {focus && <span className="text-[12px] font-semibold text-ink-2">{Math.round(focus.share * 100)}%</span>}
        </div>
      </div>
      <ul className="w-full space-y-2">
        {slices.map((s, i) => (
          <li key={s.key} className="flex items-center gap-2 text-[14px]">
            <span className="size-3 shrink-0 rounded-full" style={{ background: seriesColor(i, !!s.isOther) }} aria-hidden="true" />
            <span className="min-w-0 flex-1 truncate text-ink-2">{s.label}</span>
            <span className="font-semibold text-ink">{formatVnd(s.amount)}</span>
            <span className="w-10 text-right text-[12px] text-muted">{Math.round(s.share * 100)}%</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

/** Compact axis labels: 12.5tr, 800k. */
export function compactVnd(v: number): string {
  if (v >= 1_000_000_000) return `${(v / 1_000_000_000).toFixed(1).replace(/\.0$/, "")}tỷ`;
  if (v >= 1_000_000) return `${(v / 1_000_000).toFixed(1).replace(/\.0$/, "")}tr`;
  if (v >= 1_000) return `${Math.round(v / 1_000)}k`;
  return String(Math.round(v));
}

/** Single-series vertical bars (one measure, one axis). Last bar highlighted = current period. */
export function BarChart({
  data,
  tone,
  label,
}: {
  data: ReadonlyArray<{ key: string; label: string; value: number }>;
  tone: "income" | "expense" | "primary";
  label: string;
}) {
  const [active, setActive] = useState<number | null>(null);
  const max = Math.max(1, ...data.map((d) => d.value));
  const lastWithData = data.findLastIndex((d) => d.value > 0);
  const color = { income: "bg-income", expense: "bg-expense", primary: "bg-primary" }[tone];
  const shown = active ?? (lastWithData >= 0 ? lastWithData : data.length - 1);
  return (
    <figure>
      <figcaption className="sr-only">{label}</figcaption>
      <div className="mb-2 h-5 text-[13px] text-ink-2" aria-live="polite">
        {data[shown] && (
          <>
            <span className="text-muted">{data[shown].label}: </span>
            <span className="font-bold text-ink">{formatVnd(data[shown].value)}</span>
          </>
        )}
      </div>
      <div className="flex h-36 items-end gap-2 border-b border-line" aria-hidden="true">
        {data.map((d, i) => (
          <button
            key={d.key}
            type="button"
            tabIndex={-1}
            onPointerEnter={() => setActive(i)}
            onPointerLeave={() => setActive(null)}
            onClick={() => setActive(i)}
            className="flex h-full flex-1 items-end"
          >
            <span
              className={cx("w-full rounded-t-[4px] transition-opacity", color, i === shown ? "opacity-100" : "opacity-45")}
              style={{ height: `${Math.max(d.value > 0 ? 3 : 0, (d.value / max) * 100)}%` }}
            />
          </button>
        ))}
      </div>
      <div className="mt-1 flex gap-2 text-center text-[11px] text-muted" aria-hidden="true">
        {data.map((d) => (
          <span key={d.key} className="flex-1 truncate">
            {d.label}
          </span>
        ))}
      </div>
      <table className="sr-only">
        <tbody>
          {data.map((d) => (
            <tr key={d.key}>
              <th>{d.label}</th>
              <td>{formatVnd(d.value)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </figure>
  );
}

/** Paired income/expense bars per period — same axis, legend + labels, never colour-only. */
export function PairedBarChart({
  data,
  label,
}: {
  data: ReadonlyArray<{ key: string; label: string; income: number; expense: number }>;
  label: string;
}) {
  const [active, setActive] = useState<number | null>(null);
  const max = Math.max(1, ...data.flatMap((d) => [d.income, d.expense]));
  // Default to the latest period that has data (a future month in the range would show 0₫).
  const lastWithData = data.findLastIndex((d) => d.income > 0 || d.expense > 0);
  const shown = active ?? (lastWithData >= 0 ? lastWithData : data.length - 1);
  const cur = data[shown];
  return (
    <figure>
      <figcaption className="sr-only">{label}</figcaption>
      <div className="mb-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-[13px]">
        <span className="flex items-center gap-1.5 text-ink-2">
          <span className="size-2.5 rounded-full bg-income" aria-hidden="true" /> Thu
          {cur && <b className="text-ink">{formatVnd(cur.income)}</b>}
        </span>
        <span className="flex items-center gap-1.5 text-ink-2">
          <span className="size-2.5 rounded-full bg-expense" aria-hidden="true" /> Chi
          {cur && <b className="text-ink">{formatVnd(cur.expense)}</b>}
        </span>
        {cur && <span className="text-muted">· {cur.label}</span>}
      </div>
      <div className="flex h-36 items-end gap-3 border-b border-line" aria-hidden="true">
        {data.map((d, i) => (
          <button
            key={d.key}
            type="button"
            tabIndex={-1}
            onPointerEnter={() => setActive(i)}
            onPointerLeave={() => setActive(null)}
            onClick={() => setActive(i)}
            className={cx("flex h-full flex-1 items-end justify-center gap-[2px] transition-opacity", i === shown ? "opacity-100" : "opacity-50")}
          >
            <span className="w-1/2 rounded-t-[4px] bg-income" style={{ height: `${(d.income / max) * 100}%` }} />
            <span className="w-1/2 rounded-t-[4px] bg-expense" style={{ height: `${(d.expense / max) * 100}%` }} />
          </button>
        ))}
      </div>
      <div className="mt-1 flex gap-3 text-center text-[11px] text-muted" aria-hidden="true">
        {data.map((d) => (
          <span key={d.key} className="flex-1 truncate">
            {d.label}
          </span>
        ))}
      </div>
      <table className="sr-only">
        <thead>
          <tr>
            <th>Kỳ</th>
            <th>Thu</th>
            <th>Chi</th>
          </tr>
        </thead>
        <tbody>
          {data.map((d) => (
            <tr key={d.key}>
              <th>{d.label}</th>
              <td>{formatVnd(d.income)}</td>
              <td>{formatVnd(d.expense)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </figure>
  );
}

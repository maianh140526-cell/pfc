import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

/** WCAG 2.x contrast checks on the design tokens in globals.css (NFR-U-003 accessibility). */
const css = readFileSync(path.resolve(__dirname, "../app/globals.css"), "utf8");

function block(selector: string): Record<string, string> {
  const start = css.indexOf(`${selector} {`);
  if (start < 0) throw new Error(`selector not found: ${selector}`);
  const body = css.slice(start, css.indexOf("}", start));
  const vars: Record<string, string> = {};
  for (const m of body.matchAll(/--(pfc-[\w-]+):\s*(#[0-9a-fA-F]{6})/g)) vars[m[1]] = m[2];
  return vars;
}

function luminance(hex: string): number {
  const [r, g, b] = [1, 3, 5].map((i) => {
    const c = parseInt(hex.slice(i, i + 2), 16) / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

function contrast(a: string, b: string): number {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
}

const light = block(":root");
const dark = { ...light, ...block(':root[data-theme="dark"]') };

// [foreground, background] pairs that carry body-size text in the UI.
const PAIRS: Array<[string, string]> = [
  ["pfc-text", "pfc-bg"],
  ["pfc-text", "pfc-surface"],
  ["pfc-text-2", "pfc-surface"],
  ["pfc-muted", "pfc-surface"],
  ["pfc-muted", "pfc-bg"],
  ["pfc-on-primary", "pfc-primary"],
  ["pfc-primary", "pfc-bg"],
  ["pfc-primary", "pfc-surface"],
  ["pfc-on-primary", "pfc-expense"],
];

describe.each([
  ["light", light],
  ["dark", dark],
])("%s theme contrast", (_name, tokens) => {
  it.each(PAIRS)("%s on %s ≥ 4.5:1", (fg, bg) => {
    expect(tokens[fg], fg).toBeDefined();
    expect(tokens[bg], bg).toBeDefined();
    expect(contrast(tokens[fg], tokens[bg])).toBeGreaterThanOrEqual(4.5);
  });
});

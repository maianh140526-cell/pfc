/**
 * CSV export/import (SRS Q12/Q13). Columns: date,type,amount,category,note
 * date = "YYYY-MM-DD HH:mm" (Vietnam time), type = income|expense, amount = VND integer.
 */
export const CSV_HEADER = ["date", "type", "amount", "category", "note"] as const;

function escapeCell(v: string): string {
  // Neutralise spreadsheet formula injection (cells starting with = + - @).
  const safe = /^[=+\-@]/.test(v) ? `'${v}` : v;
  return /[",\n\r]/.test(safe) ? `"${safe.replace(/"/g, '""')}"` : safe;
}

export function toCsv(rows: ReadonlyArray<{ occurredAt: string; type: string; amount: number; category: string; note: string }>): string {
  const lines = [CSV_HEADER.join(",")];
  for (const r of rows) {
    lines.push(
      [r.occurredAt.replace("T", " "), r.type, String(r.amount), r.category, r.note].map(escapeCell).join(","),
    );
  }
  // BOM so Excel opens Vietnamese text as UTF-8.
  return `﻿${lines.join("\r\n")}\r\n`;
}

/** RFC 4180-ish parser: quoted cells, escaped quotes, CRLF/LF. */
export function parseCsv(text: string): string[][] {
  const src = text.replace(/^﻿/, "");
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = "";
  let quoted = false;
  for (let i = 0; i < src.length; i++) {
    const ch = src[i];
    if (quoted) {
      if (ch === '"' && src[i + 1] === '"') {
        cell += '"';
        i++;
      } else if (ch === '"') quoted = false;
      else cell += ch;
      continue;
    }
    if (ch === '"') quoted = true;
    else if (ch === ",") {
      row.push(cell);
      cell = "";
    } else if (ch === "\n" || ch === "\r") {
      if (ch === "\r" && src[i + 1] === "\n") i++;
      row.push(cell);
      if (row.some((c) => c.trim() !== "")) rows.push(row);
      row = [];
      cell = "";
    } else cell += ch;
  }
  row.push(cell);
  if (row.some((c) => c.trim() !== "")) rows.push(row);
  return rows;
}

export type ImportRow = { line: number; occurredAt: string; type: "income" | "expense"; amount: number; category: string; note: string };
export type ImportError = { line: number; message: string };

export const IMPORT_MAX_ROWS = 2000;

export function validateImport(text: string): { rows: ImportRow[]; errors: ImportError[] } {
  const table = parseCsv(text);
  const rows: ImportRow[] = [];
  const errors: ImportError[] = [];
  if (table.length === 0) return { rows, errors: [{ line: 1, message: "Tệp trống." }] };
  const header = table[0].map((h) => h.trim().toLowerCase());
  const idx = Object.fromEntries(CSV_HEADER.map((c) => [c, header.indexOf(c)])) as Record<(typeof CSV_HEADER)[number], number>;
  const missing = (["date", "type", "amount", "category"] as const).filter((c) => idx[c] < 0);
  if (missing.length) return { rows, errors: [{ line: 1, message: `Thiếu cột: ${missing.join(", ")}` }] };
  if (table.length - 1 > IMPORT_MAX_ROWS) {
    return { rows, errors: [{ line: 1, message: `Tối đa ${IMPORT_MAX_ROWS} dòng mỗi lần nhập.` }] };
  }
  table.slice(1).forEach((cells, i) => {
    const line = i + 2;
    const get = (c: (typeof CSV_HEADER)[number]) => (idx[c] >= 0 ? (cells[idx[c]] ?? "").trim() : "");
    const dateRaw = get("date").replace(" ", "T");
    const occurredAt = /^\d{4}-\d{2}-\d{2}$/.test(dateRaw) ? `${dateRaw}T00:00` : dateRaw.slice(0, 16);
    const type = get("type").toLowerCase();
    const amount = Number(get("amount").replace(/[.,\s₫]/g, ""));
    const category = get("category");
    if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(occurredAt) || Number.isNaN(Date.parse(`${occurredAt}:00Z`))) {
      errors.push({ line, message: "Ngày không hợp lệ (cần YYYY-MM-DD hoặc YYYY-MM-DD HH:mm)." });
    } else if (type !== "income" && type !== "expense") {
      errors.push({ line, message: 'Loại phải là "income" hoặc "expense".' });
    } else if (!Number.isInteger(amount) || amount <= 0 || amount > 999_999_999_999) {
      errors.push({ line, message: "Số tiền phải là số nguyên dương (VND)." });
    } else if (!category || category.length > 40) {
      errors.push({ line, message: "Thiếu danh mục hoặc tên quá dài." });
    } else {
      rows.push({ line, occurredAt, type, amount, category, note: get("note").replace(/^'/, "").slice(0, 200) });
    }
  });
  return { rows, errors };
}

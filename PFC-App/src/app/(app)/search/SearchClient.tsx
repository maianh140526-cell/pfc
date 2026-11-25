"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { Clock, Search, X } from "lucide-react";
import { useEffect, useState } from "react";

const KEY = "pfc:recent-searches";

/** Recent searches are a per-device convenience (localStorage); never sent to the server. */
function readRecent(): string[] {
  try {
    const v = JSON.parse(localStorage.getItem(KEY) ?? "[]") as unknown;
    return Array.isArray(v) ? v.filter((x): x is string => typeof x === "string").slice(0, 8) : [];
  } catch {
    return [];
  }
}
function saveRecent(list: string[]) {
  try {
    localStorage.setItem(KEY, JSON.stringify(list.slice(0, 8)));
  } catch {
    /* private mode: ignore */
  }
}

export function SearchField({ initial, type }: { initial: string; type?: string }) {
  const router = useRouter();
  const [q, setQ] = useState(initial);
  useEffect(() => {
    if (initial.length >= 2) saveRecent([initial, ...readRecent().filter((x) => x.toLowerCase() !== initial.toLowerCase())]);
  }, [initial]);
  return (
    <form
      role="search"
      onSubmit={(e) => {
        e.preventDefault();
        const v = q.trim();
        if (v) router.push(`/search?${new URLSearchParams({ q: v, ...(type ? { type } : {}) }).toString()}`);
      }}
      className="flex min-h-12 items-center gap-2 rounded-full border border-line bg-surface px-4 focus-within:border-primary"
    >
      <Search size={18} className="shrink-0 text-muted" />
      <input
        type="search"
        enterKeyHint="search"
        aria-label="Tìm kiếm"
        placeholder="Tìm khóa học, cơ hội, dự án…"
        autoFocus={!initial}
        value={q}
        onChange={(e) => setQ(e.target.value)}
        className="min-w-0 flex-1 bg-transparent text-[16px] text-ink outline-none placeholder:text-muted"
        maxLength={80}
      />
      {q && (
        <button type="button" aria-label="Xóa" onClick={() => setQ("")} className="grid size-8 place-items-center text-muted">
          <X size={16} />
        </button>
      )}
    </form>
  );
}

export function RecentSearches() {
  const [list, setList] = useState<string[]>([]);
  useEffect(() => setList(readRecent()), []);
  if (list.length === 0) return null;
  return (
    <div>
      <div className="mb-2 flex items-center justify-between">
        <p className="text-[15px] font-bold text-ink">Tìm kiếm gần đây</p>
        <button
          type="button"
          className="min-h-11 text-[13px] font-semibold text-primary"
          onClick={() => {
            saveRecent([]);
            setList([]);
          }}
        >
          Xóa tất cả
        </button>
      </div>
      <ul className="divide-y divide-line overflow-hidden rounded-[var(--radius-card)] border border-line bg-surface">
        {list.map((s) => (
          <li key={s}>
            <Link href={`/search?q=${encodeURIComponent(s)}`} className="flex min-h-12 items-center gap-3 px-4 text-[15px] text-ink-2 active:bg-surface-2">
              <Clock size={16} className="text-muted" /> {s}
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}

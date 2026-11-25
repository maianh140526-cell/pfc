"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Search, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";

/** Debounced search that writes ?q= into the URL so results are server-rendered and linkable. */
export function SearchBox({ placeholder }: { placeholder: string }) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const [value, setValue] = useState(params.get("q") ?? "");
  const first = useRef(true);

  useEffect(() => {
    if (first.current) {
      first.current = false;
      return;
    }
    const t = setTimeout(() => {
      const next = new URLSearchParams(params.toString());
      if (value.trim()) next.set("q", value.trim());
      else next.delete("q");
      router.replace(`${pathname}?${next.toString()}`, { scroll: false });
    }, 350);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value]);

  return (
    <div className="flex items-center gap-2 rounded-full border border-line bg-surface px-4 focus-within:border-primary">
      <Search size={18} className="shrink-0 text-muted" />
      <input
        type="search"
        enterKeyHint="search"
        value={value}
        onChange={(e) => setValue(e.target.value)}
        placeholder={placeholder}
        aria-label={placeholder}
        className="min-h-12 min-w-0 flex-1 bg-transparent text-[16px] text-ink outline-none placeholder:text-muted"
      />
      {value && (
        <button type="button" onClick={() => setValue("")} aria-label="Xóa tìm kiếm" className="grid size-8 place-items-center text-muted">
          <X size={18} />
        </button>
      )}
    </div>
  );
}

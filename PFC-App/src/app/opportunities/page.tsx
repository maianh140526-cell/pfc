"use client";

import { Briefcase, Compass, GraduationCap, LayoutGrid, Search, Trophy, X } from "lucide-react";
import Link from "next/link";
import { useEffect, useState } from "react";
import { HubError, hubFetch } from "@/platform/hub-proxy/client";
import { HubErrorState, ListSkeleton } from "@/platform/hub-proxy/HubStates";
import { OPP_RUN_HINT } from "@/modules/opportunity/session";
import type { OppList, OppType, Opportunity } from "@/modules/opportunity/types";
import { OppCard } from "@/modules/opportunity/ui/OppCard";
import { useSaves } from "@/modules/opportunity/use-saves";
import { AppHeader, Button, EmptyState, SegmentedTabs } from "@/ui";
import { cx } from "@/ui/cx";

const TYPES: ReadonlyArray<{ value: OppType | "ALL"; label: string; icon: typeof Briefcase }> = [
  { value: "ALL", label: "Tất cả", icon: LayoutGrid },
  { value: "INTERNSHIP", label: "Thực tập", icon: GraduationCap },
  { value: "JOB", label: "Việc làm", icon: Briefcase },
  { value: "SCHOLARSHIP", label: "Học bổng", icon: GraduationCap },
  { value: "COMPETITION", label: "Cuộc thi", icon: Trophy },
];

/** OPP-01 Home · OPP-02 List · OPP-03 Search · OPP-04 Filter (mockup 55). */
export default function OpportunitiesPage() {
  const [q, setQ] = useState("");
  const [query, setQuery] = useState("");
  const [type, setType] = useState<OppType | "ALL">("ALL");
  const [sort, setSort] = useState<"newest" | "deadline">("newest");
  const [items, setItems] = useState<Opportunity[]>([]);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<HubError | null>(null);
  const [nonce, setNonce] = useState(0);
  const saves = useSaves();

  useEffect(() => {
    const t = setTimeout(() => setQuery(q.trim()), 350);
    return () => clearTimeout(t);
  }, [q]);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    const p = new URLSearchParams({ sort, page: String(page), pageSize: "12" });
    if (type !== "ALL") p.set("type", type);
    if (query) p.set("q", query);
    hubFetch<OppList>("opp", `/opportunities?${p.toString()}`)
      .then((r) => {
        if (cancelled) return;
        setItems((prev) => (page === 1 ? r.items : [...prev, ...r.items]));
        setTotalPages(r.totalPages);
        setTotal(r.total);
        setError(null);
      })
      .catch((e) => !cancelled && setError(e instanceof HubError ? e : new HubError("Lỗi tải dữ liệu", 500)))
      .finally(() => !cancelled && setLoading(false));
    return () => {
      cancelled = true;
    };
  }, [type, sort, query, page, nonce]);

  // Any filter change restarts from page 1.
  useEffect(() => setPage(1), [type, sort, query]);

  return (
    <>
      <AppHeader backHref="/home" title="Opportunity Hub" />
      <div className="space-y-3 px-4">
        <p className="-mt-1 text-[14px] text-muted">Khám phá cơ hội, kiến tạo tương lai</p>
        <Link href="/opportunities/sources" className="pressable flex items-center gap-3 rounded-2xl border border-line bg-primary-soft px-4 py-3">
          <span className="min-w-0 flex-1">
            <span className="block text-[14px] font-bold text-primary">Việc làm, học bổng, cuộc thi từ các nguồn</span>
            <span className="block text-[12px] text-ink-2">UEB, Remote OK, We Work Remotely và tin do Ban điều hành PFC đăng</span>
          </span>
          <Compass size={20} className="shrink-0 text-primary" />
        </Link>
        <div className="flex items-center gap-2 rounded-full border border-line bg-surface px-4 focus-within:border-primary">
          <Search size={18} className="text-muted" />
          <input
            type="search"
            enterKeyHint="search"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Tìm cơ hội, công việc, học bổng…"
            aria-label="Tìm cơ hội"
            className="min-h-12 min-w-0 flex-1 bg-transparent text-[16px] text-ink outline-none placeholder:text-muted"
          />
          {q && (
            <button type="button" onClick={() => setQ("")} aria-label="Xóa tìm kiếm" className="text-muted">
              <X size={18} />
            </button>
          )}
        </div>
        <div className="no-scrollbar -mx-4 flex gap-3 overflow-x-auto px-4" role="radiogroup" aria-label="Loại cơ hội">
          {TYPES.map(({ value, label, icon: Icon }) => (
            <button
              key={value}
              type="button"
              role="radio"
              aria-checked={type === value}
              onClick={() => setType(value)}
              className="pressable flex w-16 shrink-0 flex-col items-center gap-1.5 text-[12px] font-semibold text-ink-2"
            >
              <span className={cx("grid size-12 place-items-center rounded-2xl", type === value ? "bg-primary text-on-primary" : "bg-primary-soft text-primary")}>
                <Icon size={22} />
              </span>
              {label}
            </button>
          ))}
        </div>
        <div className="flex items-center justify-between gap-3">
          <span className="text-[13px] text-muted">{loading && page === 1 ? "Đang tải…" : `${total} cơ hội đã xác minh`}</span>
          <SegmentedTabs
            label="Sắp xếp"
            value={sort}
            onChange={setSort}
            options={[
              { value: "newest", label: "Mới nhất" },
              { value: "deadline", label: "Sắp hết hạn" },
            ]}
          />
        </div>
      </div>

      {error ? (
        <HubErrorState error={error} onRetry={() => setNonce((n) => n + 1)} hubName="Cơ hội" runHint={OPP_RUN_HINT} />
      ) : loading && page === 1 ? (
        <ListSkeleton />
      ) : items.length === 0 ? (
        <EmptyState icon={Compass} title="Không có cơ hội phù hợp" description="Thử từ khóa khác hoặc chọn loại khác." />
      ) : (
        <div className="space-y-3 px-4 pt-3">
          {items.map((o) => (
            <OppCard key={o.id} o={o} saved={saves.ids.has(o.id)} onToggleSave={() => saves.toggle(o.id)} />
          ))}
          {page < totalPages && (
            <Button variant="secondary" block disabled={loading} onClick={() => setPage((p) => p + 1)}>
              {loading ? "Đang tải…" : "Xem thêm"}
            </Button>
          )}
        </div>
      )}
    </>
  );
}

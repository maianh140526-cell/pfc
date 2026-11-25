import Link from "next/link";
import { BookOpen, Briefcase, FileText, MessagesSquare, Newspaper, Rocket, SearchX, ShoppingBag, UserRound, UsersRound, Wallet } from "lucide-react";
import { formatVnd } from "@/lib/money";
import { currentMember, toActor } from "@/platform/auth/session";
import { SEARCH_TYPES, search, type SearchHit, type SearchType } from "@/platform/search/service";
import { AppHeader, EmptyState, Section } from "@/ui";
import { Avatar } from "@/ui/Avatar";
import { FilterChips } from "@/ui/FilterChips";
import { cx } from "@/ui/cx";
import { RecentSearches, SearchField } from "./SearchClient";

export const metadata = { title: "Tìm kiếm" };
export const dynamic = "force-dynamic";

const ICON: Record<SearchType, typeof BookOpen> = {
  course: BookOpen,
  opportunity: Briefcase,
  project: Rocket,
  listing: ShoppingBag,
  resource: FileText,
  thread: MessagesSquare,
  post: Newspaper,
  group: UsersRound,
  member: UserRound,
  transaction: Wallet,
};

/** SYS-09 Global Search · SYS-10 / SRCH-02 Search Results (mockups 9–10). */
export default async function SearchPage({ searchParams }: { searchParams: Promise<{ q?: string; type?: string }> }) {
  const { q, type } = await searchParams;
  const me = await currentMember();
  const only = type && type in SEARCH_TYPES ? (type as SearchType) : undefined;
  const r = await search(me ? toActor(me) : null, q, only, only ? 30 : 5);
  const types = (Object.keys(SEARCH_TYPES) as SearchType[]).filter((t) => me || (t !== "member" && t !== "transaction"));
  const total = Object.values(r.groups).reduce((s, g) => s + (g?.length ?? 0), 0);
  const href = (t?: string) => `/search?${new URLSearchParams({ ...(r.q ? { q: r.q } : {}), ...(t ? { type: t } : {}) }).toString()}`;

  return (
    <>
      <AppHeader back backFallback="/home" title="Tìm kiếm" />
      <div className="space-y-3 px-4">
        <SearchField initial={r.q} type={only} />
        {r.q.length >= 2 && (
          <FilterChips
            label="Loại kết quả"
            value={only ?? "all"}
            hrefFor={(t) => href(t === "all" ? undefined : t)}
            options={[{ value: "all", label: "Tất cả" }, ...types.map((t) => ({ value: t, label: SEARCH_TYPES[t] }))]}
          />
        )}
      </div>
      {r.q.length < 2 ? (
        <Section>
          <RecentSearches />
          <p className="mt-4 text-[13px] text-muted">Tìm trong khóa học, cơ hội, dự án, sản phẩm, tài liệu, diễn đàn{me ? ", thành viên và giao dịch của bạn" : ""}.</p>
        </Section>
      ) : total === 0 ? (
        <EmptyState icon={SearchX} title={`Không tìm thấy “${r.q}”`} description="Thử từ khóa ngắn hơn hoặc bỏ dấu." />
      ) : (
        (Object.keys(r.groups) as SearchType[]).map((t) => (
          <Section
            key={t}
            title={`${SEARCH_TYPES[t]} (${r.groups[t]!.length}${!only && r.groups[t]!.length >= 5 ? "+" : ""})`}
            action={
              !only && r.groups[t]!.length >= 5 ? (
                <Link href={href(t)} className="text-[14px] font-semibold text-primary">
                  Xem tất cả
                </Link>
              ) : undefined
            }
          >
            <ul className="divide-y divide-line overflow-hidden rounded-[var(--radius-card)] border border-line bg-surface">
              {r.groups[t]!.map((h) => (
                <li key={`${h.type}:${h.id}`}>
                  <Hit h={h} />
                </li>
              ))}
            </ul>
          </Section>
        ))
      )}
    </>
  );
}

function Hit({ h }: { h: SearchHit }) {
  const Icon = ICON[h.type];
  const body = (
    <>
      {h.type === "member" ? (
        <Avatar name={h.title} url={h.image} size={44} />
      ) : h.image ? (
        // eslint-disable-next-line @next/next/no-img-element -- server-processed upload
        <img src={h.image} alt="" className="size-11 shrink-0 rounded-xl object-cover" />
      ) : (
        <span className="grid size-11 shrink-0 place-items-center rounded-xl bg-primary-soft text-primary">
          <Icon size={20} />
        </span>
      )}
      <span className="min-w-0 flex-1">
        <span className="block truncate text-[15px] font-semibold text-ink">{h.title}</span>
        <span className="block truncate text-[12px] text-muted">{h.subtitle}</span>
      </span>
      {h.amount !== undefined && (
        <span className={cx("shrink-0 text-[14px] font-bold", h.type === "transaction" && h.amount < 0 ? "text-expense" : h.type === "transaction" ? "text-income" : "text-primary")}>
          {h.type === "listing" && h.amount === 0 ? "Miễn phí" : formatVnd(Math.abs(h.amount))}
        </span>
      )}
    </>
  );
  return h.href ? (
    <Link href={h.href} className="flex items-center gap-3 px-4 py-3 active:bg-surface-2">
      {body}
    </Link>
  ) : (
    <div className="flex items-center gap-3 px-4 py-3">{body}</div>
  );
}

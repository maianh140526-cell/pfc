import { ExternalLink, Globe, Plus } from "lucide-react";
import Link from "next/link";
import { after } from "next/server";
import { currentMember, toActor } from "@/platform/auth/session";
import { can } from "@/platform/roles";
import { EXT_TYPE_LABEL, LINK_ONLY_SOURCES, SOURCES, isSourceId } from "@/modules/oppfeed/domain/feed";
import { feedInfo, listExternal, refreshIfStale } from "@/modules/oppfeed/server/service";
import { ExtCard } from "@/modules/oppfeed/ui/ExtCard";
import { AppHeader, EmptyState, Section } from "@/ui";
import { FilterChips } from "@/ui/FilterChips";

export const metadata = { title: "Từ các nguồn" };
export const dynamic = "force-dynamic";

/** Opportunities gathered from UEB, job boards and PFC leaders: image, organisation, deadline and live status. */
export default async function SourcesPage({ searchParams }: { searchParams: Promise<{ type?: string; source?: string; q?: string }> }) {
  const sp = await searchParams;
  const me = await currentMember();
  // Refresh in the background (at most every 6 hours) so opening the page is never slow.
  after(async () => {
    try {
      await refreshIfStale();
    } catch (e) {
      console.error("[oppfeed] refresh failed", e);
    }
  });
  const [items, info] = await Promise.all([listExternal({ type: sp.type, source: sp.source, q: sp.q }), feedInfo()]);
  const type = sp.type && sp.type in EXT_TYPE_LABEL ? sp.type : "all";
  const source = isSourceId(sp.source) ? sp.source : "all";
  const href = (t: string, s: string) => {
    const q = new URLSearchParams();
    if (t !== "all") q.set("type", t);
    if (s !== "all") q.set("source", s);
    return `/opportunities/sources${q.size ? `?${q}` : ""}`;
  };
  const canPost = !!me && can(toActor(me), "opp.post");
  return (
    <>
      <AppHeader back backFallback="/opportunities" title="Từ các nguồn" />
      <div className="space-y-2 px-4">
        <p className="text-[13px] text-muted">
          Việc làm, học bổng, cuộc thi từ UEB, các trang tuyển dụng và Ban điều hành PFC. Bấm vào tin để xem chi tiết và mở trang gốc để ứng tuyển.
          {info.lastRefreshedAt && <> Cập nhật {new Date(info.lastRefreshedAt).toLocaleString("vi-VN", { timeZone: "Asia/Ho_Chi_Minh", dateStyle: "short", timeStyle: "short" })}.</>}
        </p>
        <FilterChips label="Loại cơ hội" value={type} hrefFor={(t) => href(t, source)} options={[{ value: "all", label: "Tất cả" }, ...Object.entries(EXT_TYPE_LABEL).map(([value, label]) => ({ value, label }))]} />
        <FilterChips
          label="Nguồn"
          value={source}
          hrefFor={(s) => href(type, s)}
          options={[{ value: "all", label: "Mọi nguồn" }, ...Object.entries(SOURCES).map(([value, s]) => ({ value, label: s.label }))]}
        />
        {canPost && (
          <Link href="/opportunities/sources/manage" className="pressable flex items-center justify-center gap-2 rounded-xl bg-primary-soft py-3 text-[14px] font-semibold text-primary">
            <Plus size={18} /> Đăng cơ hội / quản lý tin của tôi
          </Link>
        )}
      </div>
      {items.length === 0 ? (
        <EmptyState icon={Globe} title="Chưa có tin phù hợp" description="Thử bỏ bộ lọc, hoặc quay lại sau vài giờ khi nguồn được cập nhật." />
      ) : (
        <ul className="space-y-3 px-4 pt-3">
          {items.map((o) => (
            <li key={o.id}>
              <ExtCard o={o} />
            </li>
          ))}
        </ul>
      )}
      <Section title="Tìm thêm ở nơi khác">
        <ul className="space-y-2">
          {LINK_ONLY_SOURCES.map((s) => (
            <li key={s.label}>
              <a href={s.url} target="_blank" rel="noopener noreferrer" className="pressable flex items-center gap-3 rounded-xl border border-line bg-surface px-4 py-3">
                <span className="min-w-0 flex-1">
                  <span className="block text-[14px] font-semibold text-ink">{s.label}</span>
                  <span className="block text-[12px] text-muted">{s.note}</span>
                </span>
                <ExternalLink size={16} className="shrink-0 text-muted" aria-label="Mở trong tab mới" />
              </a>
            </li>
          ))}
        </ul>
        <p className="mt-3 text-[12px] text-muted">
          Việc làm từ xa lấy từ <a className="underline" href="https://remoteok.com" target="_blank" rel="noopener noreferrer">Remote OK</a> và{" "}
          <a className="underline" href="https://weworkremotely.com" target="_blank" rel="noopener noreferrer">We Work Remotely</a>; mọi tin dẫn về trang gốc.
        </p>
      </Section>
    </>
  );
}

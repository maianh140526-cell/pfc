import Link from "next/link";
import { UserSearch } from "lucide-react";
import { requireMember, toActor } from "@/platform/auth/session";
import { AVAILABILITY, listCollaborators, myCollabProfile, topSkills } from "@/modules/projects/server/collab";
import { AppHeader, Badge, ButtonLink, Card, EmptyState, Section } from "@/ui";
import { FilterChips } from "@/ui/FilterChips";
import { SearchBox } from "@/ui/SearchBox";

export const metadata = { title: "Tìm cộng sự" };
export const dynamic = "force-dynamic";

/** PRO-30/31 Find collaborators. */
export default async function CollabPage({ searchParams }: { searchParams: Promise<{ q?: string; skill?: string; availability?: string }> }) {
  const sp = await searchParams;
  const me = await requireMember("/projects/collab");
  const actor = toActor(me);
  const [list, mine, skills] = await Promise.all([listCollaborators(actor, { q: sp.q?.slice(0, 60), skill: sp.skill, availability: sp.availability }), myCollabProfile(actor), topSkills()]);
  const qs = (patch: Record<string, string | undefined>) => {
    const p = new URLSearchParams();
    for (const [k, v] of Object.entries({ q: sp.q, skill: sp.skill, availability: sp.availability, ...patch })) if (v) p.set(k, v);
    return `/projects/collab?${p.toString()}`;
  };
  return (
    <>
      <AppHeader back backFallback="/projects/more" title="Tìm cộng sự" />
      <Section>
        <Card className="flex items-center justify-between gap-3">
          <span className="min-w-0">
            <span className="block text-[14px] font-bold text-ink">{mine ? (mine.open ? "Hồ sơ của bạn đang hiển thị" : "Hồ sơ của bạn đang ẩn") : "Bạn chưa có hồ sơ cộng sự"}</span>
            <span className="block truncate text-[12px] text-muted">{mine ? mine.headline : "Tạo hồ sơ để chủ dự án tìm thấy bạn."}</span>
          </span>
          <ButtonLink href="/projects/collab/me" variant="secondary">
            {mine ? "Sửa" : "Tạo"}
          </ButtonLink>
        </Card>
      </Section>
      <div className="space-y-3 px-4 pt-4">
        <SearchBox placeholder="Tìm theo tên, kỹ năng, mong muốn…" />
        {skills.length > 0 && (
          <FilterChips label="Kỹ năng" value={sp.skill ?? ""} hrefFor={(s) => qs({ skill: s || undefined })} options={[{ value: "", label: "Mọi kỹ năng" }, ...skills.map((s) => ({ value: s, label: s }))]} />
        )}
        <FilterChips
          label="Thời gian"
          value={sp.availability && sp.availability in AVAILABILITY ? sp.availability : ""}
          hrefFor={(a) => qs({ availability: a || undefined })}
          options={[{ value: "", label: "Mọi thời gian" }, ...Object.entries(AVAILABILITY).map(([value, label]) => ({ value, label }))]}
        />
      </div>
      {list.length === 0 ? (
        <EmptyState icon={UserSearch} title="Chưa có cộng sự phù hợp" description="Thử bộ lọc khác, hoặc tạo dự án để người khác xin tham gia." />
      ) : (
        <ul className="space-y-2 px-4 pt-3 pb-6">
          {list.map((c) => (
            <li key={c.memberId}>
              <Link href={`/members/${c.memberId}`} className="pressable block rounded-[var(--radius-card)] border border-line bg-surface p-3">
                <span className="flex items-center gap-3">
                  <span className="grid size-11 shrink-0 place-items-center overflow-hidden rounded-full bg-primary-soft text-[16px] font-bold text-primary">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    {c.avatarUrl ? <img src={c.avatarUrl} alt="" className="size-full object-cover" /> : c.name.slice(0, 1).toUpperCase()}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-[15px] font-bold text-ink">{c.name}</span>
                    <span className="block truncate text-[12px] text-muted">{c.headline}</span>
                  </span>
                  <Badge tone="muted">{AVAILABILITY[c.availability]}</Badge>
                </span>
                {c.skills.length > 0 && (
                  <span className="mt-2 flex flex-wrap gap-1">
                    {c.skills.slice(0, 6).map((s) => (
                      <span key={s} className="rounded-full bg-primary-soft px-2 py-0.5 text-[12px] font-semibold text-primary">
                        {s}
                      </span>
                    ))}
                  </span>
                )}
                {c.lookingFor && <span className="mt-2 line-clamp-2 block text-[13px] text-ink-2">{c.lookingFor}</span>}
              </Link>
            </li>
          ))}
        </ul>
      )}
    </>
  );
}

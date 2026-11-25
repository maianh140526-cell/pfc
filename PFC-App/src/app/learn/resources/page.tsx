import { FileText, Paperclip } from "lucide-react";
import Link from "next/link";
import { RESOURCE_KIND_LABEL, TOPIC_LABEL } from "@/modules/education/domain/learning";
import { listPublishedResources, listSubjects } from "@/modules/education/server/service";
import { ShareBar } from "@/modules/education/ui/ShareBar";
import { AppHeader, Badge, EmptyState } from "@/ui";
import { FilterChips } from "@/ui/FilterChips";

export const metadata = { title: "Thư viện tài liệu" };
export const dynamic = "force-dynamic";

/** EDU-07/08 Reading · eBook · Templates · exercises by subject (mockup 43 / 121). */
export default async function ResourcesPage({ searchParams }: { searchParams: Promise<{ kind?: string; subject?: string }> }) {
  const { kind, subject } = await searchParams;
  const [items, subjects] = await Promise.all([listPublishedResources({ kind, subject }), listSubjects()]);
  const href = (k: string, s: string) => {
    const q = new URLSearchParams();
    if (k !== "all") q.set("kind", k);
    if (s !== "all") q.set("subject", s);
    return `/learn/resources${q.size ? `?${q}` : ""}`;
  };
  const curKind = kind && kind in RESOURCE_KIND_LABEL ? kind : "all";
  const curSubject = subject && subjects.includes(subject) ? subject : "all";
  return (
    <>
      <AppHeader back backFallback="/learn" title="Thư viện tài liệu" />
      <div className="space-y-2 px-4">
        <ShareBar />
        <FilterChips
          label="Loại tài liệu"
          value={curKind}
          hrefFor={(k) => href(k, curSubject)}
          options={[{ value: "all", label: "Tất cả" }, ...Object.entries(RESOURCE_KIND_LABEL).map(([value, label]) => ({ value, label }))]}
        />
        {subjects.length > 0 && (
          <FilterChips label="Môn học" value={curSubject} hrefFor={(s) => href(curKind, s)} options={[{ value: "all", label: "Mọi môn" }, ...subjects.map((s) => ({ value: s, label: s }))]} />
        )}
      </div>
      {items.length === 0 ? (
        <EmptyState icon={FileText} title="Chưa có tài liệu" />
      ) : (
        <ul className="mx-4 mt-3 divide-y divide-line overflow-hidden rounded-[var(--radius-card)] border border-line bg-surface">
          {items.map((r) => (
            <li key={r.id}>
              <Link href={`/learn/resources/${r.id}`} className="pressable flex items-center gap-3 px-4 py-3 active:bg-surface-2">
                <span className="grid size-11 shrink-0 place-items-center rounded-xl bg-primary-soft text-primary">
                  <FileText size={20} />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block text-[15px] font-semibold text-ink">{r.title}</span>
                  {r.description && <span className="line-clamp-2 block text-[13px] text-muted">{r.description}</span>}
                  <span className="mt-1 flex flex-wrap gap-1.5">
                    <Badge tone="muted">{RESOURCE_KIND_LABEL[r.kind]}</Badge>
                    {r.subject ? <Badge tone="primary">{r.subject}</Badge> : <Badge tone="muted">{TOPIC_LABEL[r.topic]}</Badge>}
                    {r.attachments.length > 0 && (
                      <Badge tone="muted">
                        <Paperclip size={11} className="mr-0.5 inline" />
                        {r.attachments.length}
                      </Badge>
                    )}
                  </span>
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </>
  );
}

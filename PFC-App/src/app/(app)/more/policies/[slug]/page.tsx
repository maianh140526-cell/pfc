import { notFound } from "next/navigation";
import { AlertTriangle } from "lucide-react";
import { POLICIES, POLICY_STATUS, POLICY_VERSION, policyBySlug } from "@/platform/account/policies";
import { AppHeader, Section } from "@/ui";

export function generateStaticParams() {
  return POLICIES.map((p) => ({ slug: p.slug }));
}

export default async function PolicyPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const p = policyBySlug(slug);
  if (!p) notFound();
  return (
    <>
      <AppHeader back backFallback="/more/policies" title={p.title} />
      {POLICY_STATUS === "draft" && (
        <Section>
          <p className="flex gap-2 rounded-2xl bg-warning-soft p-3 text-[13px] text-ink-2" role="note">
            <AlertTriangle size={18} className="mt-0.5 shrink-0 text-warning" />
            Bản nháp mô tả cách hệ thống đang hoạt động — cần PFC và tư vấn pháp lý duyệt trước khi công bố chính thức.
          </p>
        </Section>
      )}
      <article className="space-y-5 px-4 pt-2">
        {p.sections.map((s) => (
          <section key={s.heading}>
            <h2 className="text-[16px] font-bold text-ink">{s.heading}</h2>
            <ul className="mt-1.5 list-disc space-y-1.5 pl-5 text-[14px] leading-relaxed text-ink-2">
              {s.body.map((b) => (
                <li key={b}>{b}</li>
              ))}
            </ul>
          </section>
        ))}
        <p className="text-[12px] text-muted">Phiên bản: {POLICY_VERSION}</p>
      </article>
    </>
  );
}

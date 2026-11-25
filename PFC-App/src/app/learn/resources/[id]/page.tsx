import { ExternalLink } from "lucide-react";
import { notFound } from "next/navigation";
import { RESOURCE_KIND_LABEL, TOPIC_LABEL } from "@/modules/education/domain/learning";
import { getPublishedResource } from "@/modules/education/server/service";
import { AppHeader, Badge, ButtonLink, Card, Section } from "@/ui";
import { AttachmentList } from "@/ui/AttachmentPicker";

export const dynamic = "force-dynamic";

/** Reader view of one document / exercise: description, photos and files to download, link, attached quiz. */
export default async function ResourcePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const r = await getPublishedResource(id);
  if (!r) notFound();
  return (
    <>
      <AppHeader back backFallback="/learn/resources" title={r.title} />
      <Section>
        <div className="flex flex-wrap gap-1.5">
          <Badge tone="muted">{RESOURCE_KIND_LABEL[r.kind]}</Badge>
          <Badge tone="muted">{TOPIC_LABEL[r.topic]}</Badge>
          {r.subject && <Badge tone="primary">{r.subject}</Badge>}
        </div>
        {r.description && <p className="mt-3 whitespace-pre-line text-[15px] leading-relaxed text-ink-2">{r.description}</p>}
      </Section>
      {r.attachments.length > 0 && (
        <Section title="Ảnh và tệp đính kèm">
          <AttachmentList items={r.attachments} />
        </Section>
      )}
      {r.url && (
        <Section>
          <ButtonLink href={r.url} variant="secondary" block>
            <ExternalLink size={16} className="mr-1.5" /> Mở link tài liệu
          </ButtonLink>
        </Section>
      )}
      {r.quizId && (
        <Section title="Bài kiểm tra kèm theo">
          <Card>
            <p className="text-[15px] font-semibold text-ink">{r.quizTitle}</p>
            <div className="mt-3">
              <ButtonLink href={`/learn/quizzes/${r.quizId}`} block>
                Làm bài kiểm tra
              </ButtonLink>
            </div>
          </Card>
        </Section>
      )}
    </>
  );
}

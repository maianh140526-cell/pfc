import { TOOLS } from "@/modules/finance/ui/tools-list";
import { AppHeader, ListGroup, ListItem, Section } from "@/ui";

export const metadata = { title: "Công cụ tài chính" };


/** Mockup 113 Financial Tools. */
export default function ToolsPage() {
  return (
    <>
      <AppHeader back backFallback="/finance/more" title="Công cụ tài chính" />
      <Section>
        <ListGroup>
          {TOOLS.map((t) => (
            <ListItem key={t.slug} icon={t.icon} title={t.title} description={t.description} href={`/finance/tools/${t.slug}`} />
          ))}
        </ListGroup>
        <p className="mt-4 text-center text-[12px] leading-relaxed text-muted">
          Công cụ chỉ mang tính tham khảo, không thay thế tư vấn tài chính, đầu tư hoặc thuế chính thức.
        </p>
      </Section>
    </>
  );
}

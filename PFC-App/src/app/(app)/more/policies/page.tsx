import { FileText } from "lucide-react";
import { POLICIES } from "@/platform/account/policies";
import { AppHeader, ListGroup, ListItem, Section } from "@/ui";

export const metadata = { title: "Chính sách & Điều khoản" };

/** SYS-17 Terms & Policies (mockup 274). */
export default function PoliciesPage() {
  return (
    <>
      <AppHeader back backFallback="/more" title="Chính sách & Điều khoản" />
      <Section>
        <ListGroup>
          {POLICIES.map((p) => (
            <ListItem key={p.slug} icon={FileText} title={p.title} href={`/more/policies/${p.slug}`} />
          ))}
        </ListGroup>
      </Section>
    </>
  );
}

import { notFound } from "next/navigation";
import { AppHeader } from "@/ui";
import { TOOLS } from "@/modules/finance/ui/tools-list";
import { CompoundTool, LoanTool, RatesTool, RetirementTool, TaxTool } from "./ToolForms";

export function generateStaticParams() {
  return TOOLS.map((t) => ({ tool: t.slug }));
}

export async function generateMetadata({ params }: { params: Promise<{ tool: string }> }) {
  const { tool } = await params;
  return { title: TOOLS.find((t) => t.slug === tool)?.title ?? "Công cụ" };
}

const VIEWS = { compound: CompoundTool, loan: LoanTool, retirement: RetirementTool, tax: TaxTool, rates: RatesTool } as const;

export default async function ToolPage({ params }: { params: Promise<{ tool: string }> }) {
  const { tool } = await params;
  const meta = TOOLS.find((t) => t.slug === tool);
  if (!meta) notFound();
  const View = VIEWS[meta.slug];
  return (
    <>
      <AppHeader back backFallback="/finance/tools" title={meta.title} />
      <View />
      <p className="px-6 pt-6 text-center text-[12px] leading-relaxed text-muted">
        Kết quả chỉ mang tính tham khảo, không phải tư vấn tài chính, đầu tư hoặc thuế.
      </p>
    </>
  );
}

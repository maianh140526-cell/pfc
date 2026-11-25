import { AppHeader, Section } from "@/ui";
import { ImportPanel } from "./ImportPanel";

export const metadata = { title: "Nhập / Xuất dữ liệu" };

/** FIN-20 Export · FIN-21 Import CSV · FIN-22 Preview · FIN-23 Result (SRS Q12/Q13). */
export default function DataPage() {
  return (
    <>
      <AppHeader back backFallback="/finance/more" title="Nhập / Xuất dữ liệu" />
      <Section title="Xuất dữ liệu">
        <div className="grid grid-cols-2 gap-3">
          <a href="/finance/export?period=all" download className="pressable rounded-2xl border border-line bg-surface p-4 text-center text-[14px] font-semibold text-ink">
            Toàn bộ giao dịch
            <span className="block text-[12px] font-normal text-muted">CSV</span>
          </a>
          <a href="/finance/export?period=year" download className="pressable rounded-2xl border border-line bg-surface p-4 text-center text-[14px] font-semibold text-ink">
            Năm nay
            <span className="block text-[12px] font-normal text-muted">CSV</span>
          </a>
        </div>
      </Section>
      <Section title="Nhập từ CSV">
        <ImportPanel />
      </Section>
    </>
  );
}

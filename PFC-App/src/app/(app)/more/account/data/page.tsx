import Link from "next/link";
import { Download, FilePenLine } from "lucide-react";
import { consentHistory, getProfile } from "@/platform/account/service";
import { requireMember } from "@/platform/auth/session";
import { AppHeader, Card, Section } from "@/ui";
import { DeleteAccount } from "./DeleteAccount";

export const metadata = { title: "Dữ liệu cá nhân" };
export const dynamic = "force-dynamic";

const KIND: Record<string, string> = { privacy_settings: "Cài đặt quyền riêng tư", terms: "Điều khoản & chính sách" };

/** MEM-08 Consent · Data / Privacy Requests (mockup 275, Nghị định 13/2023/NĐ-CP). */
export default async function DataPage() {
  const me = await requireMember("/more/account/data");
  const [p, consents] = await Promise.all([getProfile(me.id), consentHistory(me.id)]);
  return (
    <>
      <AppHeader back backFallback="/more/account" title="Dữ liệu cá nhân" />
      <Section>
        <div className="space-y-3">
          <a href="/api/account/export" download className="pressable flex items-center gap-3 rounded-[var(--radius-card)] border border-line bg-surface p-4">
            <Download size={26} className="shrink-0 text-primary" />
            <span>
              <span className="block text-[15px] font-semibold text-ink">Tải xuống dữ liệu</span>
              <span className="block text-[13px] text-muted">Tệp JSON gồm hồ sơ, tài chính, học tập, đơn hàng, dự án của bạn trong PFC App.</span>
            </span>
          </a>
          <Link href="/more/account/profile" className="pressable flex items-center gap-3 rounded-[var(--radius-card)] border border-line bg-surface p-4">
            <FilePenLine size={26} className="shrink-0 text-primary" />
            <span>
              <span className="block text-[15px] font-semibold text-ink">Chỉnh sửa dữ liệu</span>
              <span className="block text-[13px] text-muted">Tự sửa thông tin cá nhân. Dữ liệu tài chính sửa trực tiếp trong mục Tài chính.</span>
            </span>
          </Link>
          <DeleteAccount email={p.email} hasPassword={p.hasPassword} />
        </div>
      </Section>
      {consents.length > 0 && (
        <Section title="Lịch sử đồng ý">
          <Card className="p-0">
            <ul className="divide-y divide-line text-[13px]">
              {consents.slice(0, 10).map((c, i) => (
                <li key={i} className="flex justify-between gap-3 px-4 py-2.5">
                  <span className="text-ink-2">{KIND[c.kind] ?? c.kind}</span>
                  <span className="text-muted">{new Date(c.createdAt).toLocaleString("vi-VN")}</span>
                </li>
              ))}
            </ul>
          </Card>
        </Section>
      )}
      <Section>
        <p className="text-[12px] text-muted">Dữ liệu ở Câu lạc bộ và Cơ hội được lưu ở dịch vụ riêng của từng nhánh.</p>
      </Section>
    </>
  );
}

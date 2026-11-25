import Link from "next/link";
import { ShieldCheck } from "lucide-react";
import { getProfile } from "@/platform/account/service";
import { requireMember } from "@/platform/auth/session";
import { AppHeader, Card, Section } from "@/ui";
import { PrivacyForm } from "./PrivacyForm";

export const metadata = { title: "Quyền riêng tư" };
export const dynamic = "force-dynamic";

/** MEM-07 Privacy Settings (mockup 272). Only options the app enforces today. */
export default async function PrivacyPage() {
  const me = await requireMember("/more/account/privacy");
  const p = await getProfile(me.id);
  return (
    <>
      <AppHeader back backFallback="/more/account" title="Quyền riêng tư" />
      <PrivacyForm initial={p.privacy} />
      <Section>
        <Card className="flex gap-3 bg-primary-soft p-4">
          <ShieldCheck size={22} className="shrink-0 text-primary" />
          <p className="text-[13px] text-ink-2">
            Dữ liệu tài chính cá nhân luôn chỉ mình bạn xem được. Tìm hiểu thêm trong{" "}
            <Link href="/more/policies/privacy" className="font-semibold text-primary">
              Chính sách quyền riêng tư
            </Link>
            .
          </p>
        </Card>
      </Section>
    </>
  );
}

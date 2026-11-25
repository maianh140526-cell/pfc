import { getProfile } from "@/platform/account/service";
import { requireMember } from "@/platform/auth/session";
import { AppHeader, Section } from "@/ui";
import { LanguagePicker } from "./LanguagePicker";

export const metadata = { title: "Ngôn ngữ" };
export const dynamic = "force-dynamic";

/** Language selection (mockup 270 / 100). */
export default async function LanguagePage() {
  const me = await requireMember("/more/account/language");
  const p = await getProfile(me.id);
  return (
    <>
      <AppHeader back backFallback="/more/account" title="Ngôn ngữ" />
      <Section>
        <LanguagePicker value={p.locale} />
      </Section>
    </>
  );
}

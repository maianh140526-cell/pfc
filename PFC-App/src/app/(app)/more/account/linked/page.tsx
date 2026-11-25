import { linkedAccounts } from "@/platform/account/service";
import { PROVIDERS, PROVIDER_LABEL, providerConfig } from "@/platform/auth/oauth";
import { requireMember } from "@/platform/auth/session";
import { publicUrl } from "@/platform/mail";
import { AppHeader, Card, Section } from "@/ui";
import { LinkedList } from "./LinkedList";

export const metadata = { title: "Liên kết tài khoản" };
export const dynamic = "force-dynamic";

const ERR: Record<string, string> = {
  identity_taken: "Tài khoản mạng xã hội này đã liên kết với một tài khoản PFC khác.",
  already_linked: "Bạn đã liên kết một tài khoản khác của nhà cung cấp này. Hủy liên kết trước.",
};

/** MEM-09 Connected Accounts (mockup 273). Only providers PFC supports are listed. */
export default async function LinkedPage({ searchParams }: { searchParams: Promise<{ linked?: string; error?: string }> }) {
  const q = await searchParams;
  const me = await requireMember("/more/account/linked");
  const links = await linkedAccounts(me.id);
  const items = PROVIDERS.map((p) => ({
    provider: p,
    label: PROVIDER_LABEL[p],
    enabled: !!providerConfig(p, process.env, publicUrl()),
    link: links.find((l) => l.provider === p) ?? null,
  }));
  return (
    <>
      <AppHeader back backFallback="/more/account" title="Liên kết tài khoản" />
      <Section>
        <p className="mb-3 text-[14px] text-muted">Kết nối với tài khoản khác để đăng nhập nhanh hơn.</p>
        {q.linked && <Card className="mb-3 bg-income-soft p-3 text-[14px] text-income">Đã liên kết {PROVIDER_LABEL[q.linked as "google"] ?? ""}.</Card>}
        {q.error && ERR[q.error] && <Card className="mb-3 bg-expense-soft p-3 text-[14px] text-expense">{ERR[q.error]}</Card>}
        <LinkedList items={items} />
      </Section>
    </>
  );
}

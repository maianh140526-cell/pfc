import { notFound } from "next/navigation";
import { requireMember, toActor } from "@/platform/auth/session";
import { can } from "@/platform/roles";
import { FLAGS, RULES, type Flag, type RuleKey } from "@/platform/settings/defaults";
import { getSettings } from "@/platform/settings/service";
import { AppHeader, Section } from "@/ui";
import { FlagToggles, MarketEditor, RulesEditor, TiersEditor } from "./SettingsClient";

export const metadata = { title: "Cấu hình" };
export const dynamic = "force-dynamic";

/** ADM-11 Configuration & feature flags; MEM point rules and tiers. Chủ nhiệm only. */
export default async function SettingsPage() {
  const me = await requireMember("/admin/settings");
  const actor = toActor(me);
  if (!can(actor, "admin.settings.manage")) notFound();
  const s = await getSettings();
  return (
    <>
      <AppHeader back backFallback="/admin" title="Cấu hình" />
      <Section title="Bật / tắt tính năng">
        <FlagToggles flags={(Object.keys(FLAGS) as Flag[]).map((k) => ({ key: k, label: FLAGS[k].label, description: FLAGS[k].description, on: s.flags[k] }))} />
      </Section>
      <Section title="Marketplace: cửa hàng chưa xác minh">
        {!s.customized.market && <p className="mb-2 rounded-xl bg-warning-soft px-3 py-2 text-[13px] text-warning">Đang dùng giới hạn đề xuất. PFC cần xác nhận hoặc sửa rồi bấm Lưu.</p>}
        <p className="mb-2 text-[13px] text-muted">Dịch vụ, khóa học, vé sự kiện luôn cần cửa hàng đã xác minh.</p>
        <MarketEditor market={s.market} />
      </Section>
      <Section title="Quy tắc cộng điểm">
        {!s.customized.rules && <p className="mb-2 rounded-xl bg-warning-soft px-3 py-2 text-[13px] text-warning">Đang dùng mức điểm đề xuất. PFC cần xác nhận hoặc sửa rồi bấm Lưu.</p>}
        <RulesEditor rules={(Object.keys(RULES) as RuleKey[]).map((k) => ({ key: k, label: RULES[k].label, cfg: s.rules[k] }))} />
      </Section>
      <Section title="Hạng thành viên">
        {!s.customized.tiers && <p className="mb-2 rounded-xl bg-warning-soft px-3 py-2 text-[13px] text-warning">Đang dùng mốc hạng đề xuất. PFC cần xác nhận hoặc sửa rồi bấm Lưu.</p>}
        <TiersEditor tiers={s.tiers} />
        <div className="h-6" />
      </Section>
    </>
  );
}

import "server-only";
import { cache } from "react";
import { z } from "zod";
import { audit } from "@/platform/audit";
import { all, run } from "@/platform/db/client";
import { ActionError } from "@/platform/errors";
import { can, type Actor } from "@/platform/roles";
import { DEFAULT_FLAGS, DEFAULT_MARKET, DEFAULT_RULES, DEFAULT_TIERS, FLAGS, RULES, validateMarket, validateRules, validateTiers, type Flag, type MarketLimits, type RuleConfig, type RuleKey, type Tier } from "./defaults";

type Settings = { flags: Record<Flag, boolean>; rules: Record<RuleKey, RuleConfig>; tiers: Tier[]; market: MarketLimits; customized: { rules: boolean; tiers: boolean; market: boolean } };

function parse<T>(raw: string | undefined, fb: T): T {
  if (!raw) return fb;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return fb;
  }
}

/** Read once per request. Unknown / missing keys fall back to defaults. */
export const getSettings = cache(async (): Promise<Settings> => {
  const rows = await all<{ key: string; value: string }>("SELECT key, value FROM app_settings");
  const m = new Map(rows.map((r) => [r.key, r.value]));
  const flags = { ...DEFAULT_FLAGS, ...parse<Partial<Record<Flag, boolean>>>(m.get("flags"), {}) };
  const rules = { ...DEFAULT_RULES, ...parse<Partial<Record<RuleKey, RuleConfig>>>(m.get("rules"), {}) };
  const tiers = parse<Tier[]>(m.get("tiers"), DEFAULT_TIERS);
  const market = { ...DEFAULT_MARKET, ...parse<Partial<MarketLimits>>(m.get("market"), {}) };
  return { flags, rules, tiers: validateTiers(tiers) ? DEFAULT_TIERS : tiers, market: validateMarket(market) ? DEFAULT_MARKET : market, customized: { rules: m.has("rules"), tiers: m.has("tiers"), market: m.has("market") } };
});

export async function isEnabled(flag: Flag): Promise<boolean> {
  return (await getSettings()).flags[flag];
}

async function put(actor: Actor, key: string, value: unknown) {
  await run(
    "INSERT INTO app_settings (key, value, updated_by, updated_at) VALUES (?, ?, ?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_by = excluded.updated_by, updated_at = excluded.updated_at",
    [key, JSON.stringify(value), actor.id, new Date().toISOString()],
  );
  await audit(actor.id, `settings.${key}`, `settings:${key}`, "success");
}

function requireSettings(actor: Actor) {
  if (!can(actor, "admin.settings.manage")) throw new ActionError("Chỉ Chủ nhiệm thay đổi cấu hình.");
}

export async function setFlag(actor: Actor, flag: unknown, on: boolean): Promise<void> {
  requireSettings(actor);
  if (typeof flag !== "string" || !(flag in FLAGS)) throw new ActionError("Tính năng không hợp lệ.");
  const s = await getSettings();
  await put(actor, "flags", { ...s.flags, [flag]: !!on });
}

export async function saveRules(actor: Actor, input: unknown): Promise<void> {
  requireSettings(actor);
  const cfg = z.object({ points: z.number(), cap: z.number().nullable(), enabled: z.boolean() });
  const r = z.record(z.string(), cfg).parse(input);
  const clean = Object.fromEntries((Object.keys(RULES) as RuleKey[]).map((k) => [k, r[k]])) as Record<RuleKey, RuleConfig>;
  const err = validateRules(clean);
  if (err) throw new ActionError(err);
  await put(actor, "rules", clean);
}

export async function saveTiers(actor: Actor, input: unknown): Promise<void> {
  requireSettings(actor);
  const t = z.array(z.object({ key: z.string().trim(), label: z.string().trim().max(30), min: z.number(), benefits: z.string().trim().max(300) })).parse(input);
  const err = validateTiers(t);
  if (err) throw new ActionError(err);
  await put(actor, "tiers", [...t].sort((a, b) => a.min - b.min));
}

export async function saveMarket(actor: Actor, input: unknown): Promise<void> {
  requireSettings(actor);
  const m = z.object({ basicMaxPrice: z.number(), basicMaxListings: z.number() }).parse(input);
  const err = validateMarket(m);
  if (err) throw new ActionError(err);
  await put(actor, "market", m);
}

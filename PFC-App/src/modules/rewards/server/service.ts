import "server-only";
import { randomBytes, randomUUID } from "node:crypto";
import { z } from "zod";
import { audit } from "@/platform/audit";
import { all, one, run, withTransaction } from "@/platform/db/client";
import { ActionError } from "@/platform/errors";
import { notify } from "@/platform/notifications/service";
import { can, type Actor } from "@/platform/roles";
import { RULES, tierFor, type RuleKey, type Tier } from "@/platform/settings/defaults";
import { getSettings } from "@/platform/settings/service";

/**
 * G7 Points & tiers (MEM-10…14). Append-only ledger: balance = SUM(delta); tier = lifetime earned
 * (earn + positive adjustments), so redeeming never lowers a tier. Each (rule, reference) earns once.
 */
const now = () => new Date().toISOString();
const vnDay = (d = new Date()) => new Date(d.getTime() + 7 * 3600_000).toISOString().slice(0, 10);

export async function balanceOf(memberId: string): Promise<{ balance: number; lifetime: number }> {
  const r = await one<{ b: number; l: number }>(
    "SELECT COALESCE(SUM(delta),0) AS b, COALESCE(SUM(CASE WHEN kind = 'earn' OR (kind = 'adjust' AND delta > 0) THEN delta ELSE 0 END),0) AS l FROM pts_ledger WHERE member_id = ?",
    [memberId],
  );
  return { balance: Number(r?.b ?? 0), lifetime: Number(r?.l ?? 0) };
}

/**
 * Awards points for a rule once per reference (idempotent), within the daily cap. Never throws:
 * a points problem must not break the action that earned them.
 */
export async function awardPoints(memberId: string, rule: RuleKey, ref: string): Promise<number> {
  try {
    const s = await getSettings();
    const cfg = s.rules[rule];
    if (!s.flags.rewards || !cfg?.enabled || cfg.points <= 0) return 0;
    if (cfg.cap !== null) {
      const startUtc = new Date(Date.parse(`${vnDay()}T00:00:00+07:00`)).toISOString();
      const n = await one<{ n: number }>("SELECT COUNT(*) AS n FROM pts_ledger WHERE member_id = ? AND rule_key = ? AND kind = 'earn' AND created_at >= ?", [memberId, rule, startUtc]);
      if (Number(n?.n ?? 0) >= cfg.cap) return 0;
    }
    const before = await balanceOf(memberId);
    const inserted = await run(
      "INSERT INTO pts_ledger (id, member_id, delta, kind, rule_key, ref, note, created_at) VALUES (?, ?, ?, 'earn', ?, ?, ?, ?) ON CONFLICT DO NOTHING",
      [randomUUID(), memberId, cfg.points, rule, ref, RULES[rule].label, now()],
    );
    if (!inserted) return 0;
    const t0 = tierFor(before.lifetime, s.tiers).current;
    const t1 = tierFor(before.lifetime + cfg.points, s.tiers).current;
    await notify(memberId, { category: "rewards", title: `+${cfg.points} điểm: ${RULES[rule].label}`, href: "/rewards" });
    if (t1.key !== t0.key) await notify(memberId, { category: "rewards", title: `Chúc mừng! Bạn đã lên hạng ${t1.label}`, body: t1.benefits, href: "/rewards" });
    return cfg.points;
  } catch (err) {
    console.error("[rewards] award failed", rule, err);
    return 0;
  }
}

export async function referralCode(memberId: string): Promise<string> {
  const have = await one<{ code: string }>("SELECT code FROM pts_codes WHERE member_id = ?", [memberId]);
  if (have) return have.code;
  const abc = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  for (let i = 0; i < 5; i++) {
    const code = Array.from(randomBytes(7), (b) => abc[b % abc.length]).join("");
    if (await run("INSERT INTO pts_codes (member_id, code) VALUES (?, ?) ON CONFLICT DO NOTHING", [memberId, code])) return code;
    const again = await one<{ code: string }>("SELECT code FROM pts_codes WHERE member_id = ?", [memberId]);
    if (again) return again.code;
  }
  throw new ActionError("Không tạo được mã giới thiệu. Thử lại.");
}

/** Called right after sign-up with the ?ref= code. Self-referral and unknown codes are ignored. */
export async function recordReferral(newMemberId: string, rawCode: unknown): Promise<void> {
  const code = typeof rawCode === "string" ? rawCode.trim().toUpperCase().slice(0, 12) : "";
  if (!/^[A-Z0-9]{7}$/.test(code)) return;
  const owner = await one<{ member_id: string }>("SELECT member_id FROM pts_codes WHERE code = ?", [code]);
  if (!owner || owner.member_id === newMemberId) return;
  await run("INSERT INTO pts_referrals (referee_id, referrer_id, created_at) VALUES (?, ?, ?) ON CONFLICT DO NOTHING", [newMemberId, owner.member_id, now()]);
}

/** The referrer earns once the new member finishes onboarding (a real, active account). */
export async function rewardReferral(refereeId: string): Promise<void> {
  const r = await one<{ referrer_id: string }>("SELECT referrer_id FROM pts_referrals WHERE referee_id = ? AND rewarded = 0", [refereeId]);
  if (!r) return;
  if (await run("UPDATE pts_referrals SET rewarded = 1 WHERE referee_id = ? AND rewarded = 0", [refereeId])) await awardPoints(r.referrer_id, "referral", refereeId);
}

export type RewardsOverview = {
  balance: number;
  lifetime: number;
  tier: Tier;
  next: Tier | null;
  progress: number;
  tiers: Tier[];
  code: string;
  referrals: number;
  history: { id: string; delta: number; kind: string; note: string; createdAt: string }[];
  rules: { key: RuleKey; label: string; points: number; cap: number | null }[];
  enabled: boolean;
};

export async function overview(actor: Actor): Promise<RewardsOverview> {
  const s = await getSettings();
  const { balance, lifetime } = await balanceOf(actor.id);
  const t = tierFor(lifetime, s.tiers);
  const history = await all<{ id: string; delta: number; kind: string; note: string; created_at: string }>("SELECT id, delta, kind, note, created_at FROM pts_ledger WHERE member_id = ? ORDER BY created_at DESC LIMIT 50", [actor.id]);
  const refs = await one<{ n: number }>("SELECT COUNT(*) AS n FROM pts_referrals WHERE referrer_id = ?", [actor.id]);
  return {
    balance,
    lifetime,
    tier: t.current,
    next: t.next,
    progress: t.progress,
    tiers: s.tiers,
    code: await referralCode(actor.id),
    referrals: Number(refs?.n ?? 0),
    history: history.map((h) => ({ id: h.id, delta: Number(h.delta), kind: h.kind, note: h.note, createdAt: h.created_at })),
    rules: (Object.keys(RULES) as RuleKey[]).filter((k) => s.rules[k].enabled && s.rules[k].points > 0).map((k) => ({ key: k, label: RULES[k].label, points: s.rules[k].points, cap: s.rules[k].cap })),
    enabled: s.flags.rewards,
  };
}

/** Tier label for a member (profile badge). */
export async function tierOf(memberId: string): Promise<Tier> {
  const s = await getSettings();
  return tierFor((await balanceOf(memberId)).lifetime, s.tiers).current;
}

// ───────────────────────── Catalog & redemption (MEM-12/13) ─────────────────────────

export type Reward = { id: string; title: string; description: string; partner: string; cost: number; stock: number | null; minTier: string | null; active: boolean };
const toReward = (r: { id: string; title: string; description: string; partner: string; cost: number; stock: number | null; min_tier: string | null; active: number }): Reward => ({
  id: r.id,
  title: r.title,
  description: r.description,
  partner: r.partner,
  cost: Number(r.cost),
  stock: r.stock === null ? null : Number(r.stock),
  minTier: r.min_tier,
  active: !!r.active,
});

export async function listRewards(includeInactive = false): Promise<Reward[]> {
  return (await all<Parameters<typeof toReward>[0]>(`SELECT * FROM pts_rewards ${includeInactive ? "" : "WHERE active = 1"} ORDER BY cost`)).map(toReward);
}

const rewardSchema = z.object({
  title: z.string().trim().min(3, "Tên quà tối thiểu 3 ký tự.").max(80),
  description: z.string().trim().max(500).default(""),
  partner: z.string().trim().max(80).default(""),
  cost: z.coerce.number().int().min(1, "Số điểm phải ≥ 1.").max(1_000_000),
  stock: z.preprocess((v) => (v === "" || v === null || v === undefined ? null : v), z.union([z.null(), z.coerce.number().int().min(0)])),
  minTier: z.string().trim().max(20).nullable().default(null),
  active: z.boolean().default(true),
});

function requireManage(actor: Actor) {
  if (!can(actor, "rewards.manage")) throw new ActionError("Bạn không có quyền quản lý điểm thưởng.");
}

export async function saveReward(actor: Actor, id: string | null, input: unknown): Promise<string> {
  requireManage(actor);
  const d = rewardSchema.parse(input);
  const minTier = d.minTier && (await getSettings()).tiers.some((t) => t.key === d.minTier) ? d.minTier : null;
  if (id) {
    const n = await run("UPDATE pts_rewards SET title = ?, description = ?, partner = ?, cost = ?, stock = ?, min_tier = ?, active = ?, updated_at = ? WHERE id = ?", [d.title, d.description, d.partner, d.cost, d.stock, minTier, d.active ? 1 : 0, now(), id]);
    if (!n) throw new ActionError("Không tìm thấy quà.");
  } else {
    id = randomUUID();
    await run("INSERT INTO pts_rewards (id, title, description, partner, cost, stock, min_tier, active, created_by, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)", [id, d.title, d.description, d.partner, d.cost, d.stock, minTier, d.active ? 1 : 0, actor.id, now(), now()]);
  }
  await audit(actor.id, "rewards.catalog.save", `reward:${id}`, "success");
  return id;
}

/** Spend points on a reward. Balance, stock and tier are re-checked inside one write transaction. */
export async function redeem(actor: Actor, rewardId: string): Promise<string> {
  const s = await getSettings();
  if (!s.flags.rewards) throw new ActionError("Điểm thưởng đang tạm tắt.");
  const rw = await one<Parameters<typeof toReward>[0]>("SELECT * FROM pts_rewards WHERE id = ? AND active = 1", [rewardId]);
  if (!rw) throw new ActionError("Quà không còn được đổi.");
  const reward = toReward(rw);
  const { lifetime } = await balanceOf(actor.id);
  if (reward.minTier) {
    const need = s.tiers.find((t) => t.key === reward.minTier);
    if (need && lifetime < need.min) throw new ActionError(`Quà này dành cho hạng ${need.label} trở lên.`);
  }
  const id = randomUUID();
  await withTransaction(async (tx) => {
    const bal = Number((await tx.execute("SELECT COALESCE(SUM(delta),0) AS b FROM pts_ledger WHERE member_id = ?", [actor.id])).rows[0].b);
    if (bal < reward.cost) throw new ActionError(`Bạn cần ${reward.cost.toLocaleString("vi-VN")} điểm, hiện có ${bal.toLocaleString("vi-VN")}.`);
    if (reward.stock !== null) {
      const r = await tx.execute("UPDATE pts_rewards SET stock = stock - 1, updated_at = ? WHERE id = ? AND stock > 0", [now(), rewardId]);
      if (!r.rowsAffected) throw new ActionError("Quà đã hết.");
    }
    await tx.execute("INSERT INTO pts_redemptions (id, reward_id, member_id, cost, status, created_at, updated_at) VALUES (?, ?, ?, ?, 'requested', ?, ?)", [id, rewardId, actor.id, reward.cost, now(), now()]);
    await tx.execute("INSERT INTO pts_ledger (id, member_id, delta, kind, ref, note, created_at) VALUES (?, ?, ?, 'redeem', ?, ?, ?)", [randomUUID(), actor.id, -reward.cost, id, `Đổi quà: ${reward.title}`, now()]);
  });
  return id;
}

export type Redemption = { id: string; rewardTitle: string; memberName: string; memberId: string; cost: number; status: "requested" | "fulfilled" | "cancelled"; note: string; createdAt: string };

export async function myRedemptions(actor: Actor): Promise<Redemption[]> {
  return redemptions("WHERE d.member_id = ?", [actor.id]);
}
export async function redemptionQueue(actor: Actor): Promise<Redemption[]> {
  requireManage(actor);
  return redemptions("WHERE d.status = 'requested'", []);
}
async function redemptions(where: string, args: string[]): Promise<Redemption[]> {
  return (
    await all<{ id: string; title: string; full_name: string; member_id: string; cost: number; status: Redemption["status"]; note: string; created_at: string }>(
      `SELECT d.id, r.title, m.full_name, d.member_id, d.cost, d.status, d.note, d.created_at FROM pts_redemptions d JOIN pts_rewards r ON r.id = d.reward_id JOIN members m ON m.id = d.member_id ${where} ORDER BY d.created_at DESC LIMIT 100`,
      args,
    )
  ).map((r) => ({ id: r.id, rewardTitle: r.title, memberName: r.full_name, memberId: r.member_id, cost: Number(r.cost), status: r.status, note: r.note, createdAt: r.created_at }));
}

/** Staff hand over the gift (fulfil, with a note such as the voucher code) or cancel (points refunded). */
export async function decideRedemption(actor: Actor, id: string, fulfil: boolean, note: string): Promise<void> {
  requireManage(actor);
  const text = z.string().trim().min(fulfil ? 0 : 3, "Cần ghi lý do hủy.").max(300).parse(note ?? "");
  const d = await one<{ member_id: string; cost: number; reward_id: string; title: string }>("SELECT d.member_id, d.cost, d.reward_id, r.title FROM pts_redemptions d JOIN pts_rewards r ON r.id = d.reward_id WHERE d.id = ? AND d.status = 'requested'", [id]);
  if (!d) throw new ActionError("Yêu cầu đã được xử lý.");
  const n = await run("UPDATE pts_redemptions SET status = ?, note = ?, decided_by = ?, updated_at = ? WHERE id = ? AND status = 'requested'", [fulfil ? "fulfilled" : "cancelled", text, actor.id, now(), id]);
  if (n !== 1) throw new ActionError("Yêu cầu đã được xử lý.");
  if (!fulfil) {
    await run("INSERT INTO pts_ledger (id, member_id, delta, kind, ref, note, created_by, created_at) VALUES (?, ?, ?, 'refund', ?, ?, ?, ?)", [randomUUID(), d.member_id, Number(d.cost), id, `Hoàn điểm: ${d.title}`, actor.id, now()]);
    await run("UPDATE pts_rewards SET stock = stock + 1 WHERE id = ? AND stock IS NOT NULL", [d.reward_id]);
  }
  await audit(actor.id, `rewards.redemption.${fulfil ? "fulfil" : "cancel"}`, `redemption:${id}`, "success");
  await notify(d.member_id, {
    category: "rewards",
    title: fulfil ? `Quà “${d.title}” đã sẵn sàng` : `Yêu cầu đổi “${d.title}” bị hủy, đã hoàn ${Number(d.cost).toLocaleString("vi-VN")} điểm`,
    body: text,
    href: "/rewards",
  });
}

/** Manual correction by staff, always with a reason (audited). */
export async function adjustPoints(actor: Actor, memberId: string, delta: number, note: string): Promise<void> {
  requireManage(actor);
  const d = z.number().int().refine((v) => v !== 0 && Math.abs(v) <= 100_000, "Số điểm điều chỉnh không hợp lệ.").parse(delta);
  const why = z.string().trim().min(5, "Cần ghi lý do điều chỉnh.").max(200).parse(note);
  if (!(await one("SELECT 1 AS x FROM members WHERE id = ?", [memberId]))) throw new ActionError("Không tìm thấy thành viên.");
  if (d < 0 && (await balanceOf(memberId)).balance + d < 0) throw new ActionError("Không thể trừ quá số điểm hiện có.");
  await run("INSERT INTO pts_ledger (id, member_id, delta, kind, note, created_by, created_at) VALUES (?, ?, ?, 'adjust', ?, ?, ?)", [randomUUID(), memberId, d, why, actor.id, now()]);
  await audit(actor.id, "rewards.adjust", `member:${memberId}`, "success");
  await notify(memberId, { category: "rewards", title: `${d > 0 ? "+" : ""}${d} điểm (điều chỉnh)`, body: why, href: "/rewards" });
}

import "server-only";
import { randomUUID } from "node:crypto";
import { all, one, tx } from "@/platform/db/client";
import { DEFAULT_CATEGORIES, type CategoryIcon, type TxType } from "../domain/categories";
import { budgetUsage, byCategory, monthlySeries, totals, type TxLite } from "../domain/analytics";
import { monthRange, shiftMonth } from "../domain/dates";
import type { ChallengeStatus, ChallengeType } from "../domain/challenge";

/**
 * Read side of Personal Finance. Every query takes memberId and filters on it:
 * financial data is owner-only (BR-009, NFR-S-003). Never accept a member id from the client.
 */

export type Category = { id: string; name: string; icon: CategoryIcon; type: TxType; archived: boolean };
export type Transaction = {
  id: string;
  type: TxType;
  amount: number;
  note: string;
  occurredAt: string;
  categoryId: string;
  categoryName: string;
  categoryIcon: CategoryIcon;
};

type CatRow = { id: string; name: string; icon: string; type: string; archived: number };
const toCategory = (r: CatRow): Category => ({
  id: r.id,
  name: r.name,
  icon: r.icon as CategoryIcon,
  type: r.type as TxType,
  archived: Number(r.archived) === 1,
});

/** Seeds the PFC Quỹ default categories the first time a member opens Finance. */
export async function ensureDefaultCategories(memberId: string): Promise<void> {
  const row = await one<{ n: number }>("SELECT COUNT(*) AS n FROM fin_categories WHERE member_id = ?", [memberId]);
  if (Number(row?.n ?? 0) > 0) return;
  const now = new Date().toISOString();
  await tx(
    DEFAULT_CATEGORIES.map((c) => ({
      sql: "INSERT INTO fin_categories (id, member_id, name, icon, type, created_at) VALUES (?, ?, ?, ?, ?, ?)",
      args: [randomUUID(), memberId, c.name, c.icon, c.type, now],
    })),
  );
}

export async function listCategories(memberId: string, opts: { includeArchived?: boolean } = {}): Promise<Category[]> {
  await ensureDefaultCategories(memberId);
  const rows = await all<CatRow>(
    `SELECT id, name, icon, type, archived FROM fin_categories
     WHERE member_id = ? ${opts.includeArchived ? "" : "AND archived = 0"}
     ORDER BY type, created_at, rowid`,
    [memberId],
  );
  return rows.map(toCategory);
}

export async function getCategory(memberId: string, id: string): Promise<Category | null> {
  const r = await one<CatRow>(
    "SELECT id, name, icon, type, archived FROM fin_categories WHERE member_id = ? AND id = ?",
    [memberId, id],
  );
  return r ? toCategory(r) : null;
}

type TxRow = {
  id: string;
  type: string;
  amount: number;
  note: string;
  occurred_at: string;
  category_id: string;
  category_name: string;
  category_icon: string;
};
const toTx = (r: TxRow): Transaction => ({
  id: r.id,
  type: r.type as TxType,
  amount: Number(r.amount),
  note: r.note,
  occurredAt: r.occurred_at,
  categoryId: r.category_id,
  categoryName: r.category_name,
  categoryIcon: r.category_icon as CategoryIcon,
});

const TX_SELECT = `SELECT t.id, t.type, t.amount, t.note, t.occurred_at, t.category_id,
  c.name AS category_name, c.icon AS category_icon
  FROM fin_transactions t JOIN fin_categories c ON c.id = t.category_id`;

export type TxFilter = {
  start?: string;
  end?: string;
  type?: TxType;
  categoryId?: string;
  q?: string;
  limit?: number;
};

export async function listTransactions(memberId: string, f: TxFilter = {}): Promise<Transaction[]> {
  const where = ["t.member_id = ?"];
  const args: (string | number)[] = [memberId];
  if (f.start) (where.push("t.occurred_at >= ?"), args.push(f.start));
  if (f.end) (where.push("t.occurred_at < ?"), args.push(f.end));
  if (f.type) (where.push("t.type = ?"), args.push(f.type));
  if (f.categoryId) (where.push("t.category_id = ?"), args.push(f.categoryId));
  if (f.q?.trim()) {
    where.push("(t.note LIKE ? ESCAPE '\\' OR c.name LIKE ? ESCAPE '\\')");
    const like = `%${f.q.trim().replace(/[\\%_]/g, (m) => `\\${m}`)}%`;
    args.push(like, like);
  }
  const limit = Math.min(Math.max(f.limit ?? 500, 1), 5000);
  const rows = await all<TxRow>(
    `${TX_SELECT} WHERE ${where.join(" AND ")} ORDER BY t.occurred_at DESC, t.created_at DESC LIMIT ${limit}`,
    args,
  );
  return rows.map(toTx);
}

export async function getTransaction(memberId: string, id: string): Promise<Transaction | null> {
  const r = await one<TxRow>(`${TX_SELECT} WHERE t.member_id = ? AND t.id = ?`, [memberId, id]);
  return r ? toTx(r) : null;
}

const lite = (t: Transaction): TxLite => ({ type: t.type, amount: t.amount, categoryId: t.categoryId, occurredAt: t.occurredAt });

export async function monthOverview(memberId: string, month: string) {
  const prev = shiftMonth(month, -1);
  const [cur, before] = await Promise.all([
    listTransactions(memberId, { ...monthRange(month), limit: 5000 }),
    listTransactions(memberId, { ...monthRange(prev), limit: 5000 }),
  ]);
  return { transactions: cur, totals: totals(cur.map(lite)), previous: totals(before.map(lite)) };
}

/** Last `count` months ending at `month`, oldest first. */
export async function seriesEnding(memberId: string, month: string, count: number) {
  const months = Array.from({ length: count }, (_, i) => shiftMonth(month, i - count + 1));
  const txs = await listTransactions(memberId, {
    start: monthRange(months[0]).start,
    end: monthRange(month).end,
    limit: 5000,
  });
  return monthlySeries(txs.map(lite), months);
}

export function categorySlices(txs: Transaction[], type: TxType, categories: Category[], maxSlices = 5) {
  const byId = new Map(categories.map((c) => [c.id, c]));
  return byCategory(txs.map(lite), type, maxSlices).map((s) => {
    const cat = s.categoryId ? byId.get(s.categoryId) : undefined;
    return { ...s, name: cat?.name ?? "Khác", icon: (cat?.icon ?? "more") as CategoryIcon };
  });
}

export type BudgetLine = {
  id: string;
  categoryId: string;
  categoryName: string;
  categoryIcon: CategoryIcon;
  limit: number;
  spent: number;
  pct: number;
  remaining: number;
  state: "ok" | "warning" | "over";
};

export async function budgetsForMonth(memberId: string, month: string): Promise<BudgetLine[]> {
  const { start, end } = monthRange(month);
  const rows = await all<{
    id: string;
    category_id: string;
    name: string;
    icon: string;
    limit_amount: number;
    spent: number;
  }>(
    `SELECT b.id, b.category_id, c.name, c.icon, b.limit_amount,
       COALESCE((SELECT SUM(t.amount) FROM fin_transactions t
         WHERE t.member_id = b.member_id AND t.category_id = b.category_id AND t.type = 'expense'
           AND t.occurred_at >= ? AND t.occurred_at < ?), 0) AS spent
     FROM fin_budgets b JOIN fin_categories c ON c.id = b.category_id
     WHERE b.member_id = ? AND b.month = ?
     ORDER BY c.name`,
    [start, end, memberId, month],
  );
  return rows.map((r) => {
    const spent = Number(r.spent);
    const limit = Number(r.limit_amount);
    return {
      id: r.id,
      categoryId: r.category_id,
      categoryName: r.name,
      categoryIcon: r.icon as CategoryIcon,
      limit,
      spent,
      ...budgetUsage(spent, limit),
    };
  });
}

export async function getBudget(memberId: string, id: string) {
  const r = await one<{ id: string; month: string; category_id: string }>(
    "SELECT id, month, category_id FROM fin_budgets WHERE member_id = ? AND id = ?",
    [memberId, id],
  );
  if (!r) return null;
  const line = (await budgetsForMonth(memberId, r.month)).find((b) => b.id === id);
  return line ? { ...line, month: r.month } : null;
}

export type Goal = {
  id: string;
  name: string;
  target: number;
  current: number;
  deadline: string;
  createdAt: string;
};

type GoalRow = { id: string; name: string; target_amount: number; current_amount: number; deadline: string; created_at: string };
const toGoal = (r: GoalRow): Goal => ({
  id: r.id,
  name: r.name,
  target: Number(r.target_amount),
  current: Number(r.current_amount),
  deadline: r.deadline,
  createdAt: r.created_at,
});

export async function listGoals(memberId: string): Promise<Goal[]> {
  const rows = await all<GoalRow>(
    "SELECT id, name, target_amount, current_amount, deadline, created_at FROM fin_goals WHERE member_id = ? ORDER BY deadline",
    [memberId],
  );
  return rows.map(toGoal);
}

export async function getGoal(memberId: string, id: string): Promise<Goal | null> {
  const r = await one<GoalRow>(
    "SELECT id, name, target_amount, current_amount, deadline, created_at FROM fin_goals WHERE member_id = ? AND id = ?",
    [memberId, id],
  );
  return r ? toGoal(r) : null;
}

export type Challenge = {
  id: string;
  title: string;
  type: ChallengeType;
  target: number;
  durationDays: number;
  startDate: string;
  firstCheckIn: string | null;
  lastCheckIn: string | null;
  checkedDays: number;
  progress: number;
  status: ChallengeStatus;
};

type ChRow = {
  id: string;
  title: string;
  challenge_type: string;
  target_amount: number;
  duration_days: number;
  start_date: string;
  first_check_in: string | null;
  last_check_in: string | null;
  checked_days: number;
  progress_amount: number;
  status: string;
};
const toChallenge = (r: ChRow): Challenge => ({
  id: r.id,
  title: r.title,
  type: r.challenge_type as ChallengeType,
  target: Number(r.target_amount),
  durationDays: Number(r.duration_days),
  startDate: r.start_date,
  firstCheckIn: r.first_check_in,
  lastCheckIn: r.last_check_in,
  checkedDays: Number(r.checked_days),
  progress: Number(r.progress_amount),
  status: r.status as ChallengeStatus,
});

const CH_COLS =
  "id, title, challenge_type, target_amount, duration_days, start_date, first_check_in, last_check_in, checked_days, progress_amount, status";

export async function listChallenges(memberId: string): Promise<Challenge[]> {
  const rows = await all<ChRow>(
    `SELECT ${CH_COLS} FROM fin_challenges WHERE member_id = ? ORDER BY status = 'active' DESC, created_at DESC`,
    [memberId],
  );
  return rows.map(toChallenge);
}

export async function getChallenge(memberId: string, id: string): Promise<Challenge | null> {
  const r = await one<ChRow>(`SELECT ${CH_COLS} FROM fin_challenges WHERE member_id = ? AND id = ?`, [memberId, id]);
  return r ? toChallenge(r) : null;
}

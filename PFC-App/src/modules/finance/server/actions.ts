"use server";

import { randomUUID } from "node:crypto";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { safeAction, type ActionResult } from "@/platform/action-result";
import { ActionError, requireMemberForAction } from "@/platform/auth/session";
import { audit } from "@/platform/audit";
import { all, one, run, tx } from "@/platform/db/client";
import { MAX_AMOUNT_VND } from "@/lib/money";
import { isCategoryIcon } from "../domain/categories";
import { challengeProgress, evaluateChallengeStatus } from "../domain/challenge";
import { validateImport, type ImportError } from "../domain/csv";
import { isMonthKey, nowLocal, shiftMonth, todayLocal } from "../domain/dates";
import { ensureDefaultCategories, getCategory, getChallenge, getGoal, getTransaction } from "./queries";

/**
 * Write side of Personal Finance. Pattern for every action:
 *   requireMemberForAction() → validate with zod → check ownership of every referenced id
 *   → write scoped by member_id → revalidate the finance screens.
 */

const amount = z.coerce
  .number({ invalid_type_error: "Số tiền không hợp lệ." })
  .int("Số tiền phải là số nguyên.")
  .positive("Số tiền phải lớn hơn 0.")
  .max(MAX_AMOUNT_VND, "Số tiền quá lớn.");
const localDateTime = z.string().regex(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/, "Ngày giờ không hợp lệ.");
const localDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Ngày không hợp lệ.");
const id = z.string().uuid("Mã không hợp lệ.");
const txType = z.enum(["income", "expense"]);

const refresh = () => revalidatePath("/finance", "layout");

const txSchema = z.object({
  type: txType,
  amount,
  categoryId: id,
  occurredAt: localDateTime,
  note: z.string().trim().max(200, "Ghi chú tối đa 200 ký tự.").default(""),
});

async function assertCategory(memberId: string, categoryId: string, type: "income" | "expense") {
  const cat = await getCategory(memberId, categoryId);
  if (!cat) throw new ActionError("Danh mục không tồn tại.");
  if (cat.type !== type) throw new ActionError("Danh mục không khớp với loại giao dịch.");
}

export async function createTransactionAction(input: unknown): Promise<ActionResult<{ id: string }>> {
  return safeAction(async () => {
    const me = await requireMemberForAction();
    const d = txSchema.parse(input);
    await assertCategory(me.id, d.categoryId, d.type);
    const newId = randomUUID();
    const now = new Date().toISOString();
    await run(
      `INSERT INTO fin_transactions (id, member_id, type, amount, category_id, note, occurred_at, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [newId, me.id, d.type, d.amount, d.categoryId, d.note, d.occurredAt, now, now],
    );
    refresh();
    return { id: newId };
  });
}

export async function updateTransactionAction(txId: string, input: unknown): Promise<ActionResult> {
  return safeAction(async () => {
    const me = await requireMemberForAction();
    id.parse(txId);
    const d = txSchema.parse(input);
    if (!(await getTransaction(me.id, txId))) throw new ActionError("Không tìm thấy giao dịch.");
    await assertCategory(me.id, d.categoryId, d.type);
    await run(
      `UPDATE fin_transactions SET type = ?, amount = ?, category_id = ?, note = ?, occurred_at = ?, updated_at = ?
       WHERE id = ? AND member_id = ?`,
      [d.type, d.amount, d.categoryId, d.note, d.occurredAt, new Date().toISOString(), txId, me.id],
    );
    refresh();
    return undefined;
  });
}

export async function deleteTransactionAction(txId: string): Promise<ActionResult> {
  return safeAction(async () => {
    const me = await requireMemberForAction();
    id.parse(txId);
    const n = await run("DELETE FROM fin_transactions WHERE id = ? AND member_id = ?", [txId, me.id]);
    if (n === 0) throw new ActionError("Không tìm thấy giao dịch.");
    await audit(me.id, "finance.transaction.delete", `transaction:${txId}`, "success");
    refresh();
    return undefined;
  });
}

/** Mockup 30 "Duplicate": same data, dated now. */
export async function duplicateTransactionAction(txId: string): Promise<ActionResult<{ id: string }>> {
  return safeAction(async () => {
    const me = await requireMemberForAction();
    id.parse(txId);
    const t = await getTransaction(me.id, txId);
    if (!t) throw new ActionError("Không tìm thấy giao dịch.");
    const newId = randomUUID();
    const now = new Date().toISOString();
    await run(
      `INSERT INTO fin_transactions (id, member_id, type, amount, category_id, note, occurred_at, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [newId, me.id, t.type, t.amount, t.categoryId, t.note, nowLocal(), now, now],
    );
    refresh();
    return { id: newId };
  });
}

// ---------- Categories (FIN-08) ----------

const categorySchema = z.object({
  name: z.string().trim().min(1, "Vui lòng nhập tên danh mục.").max(40, "Tên tối đa 40 ký tự."),
  icon: z.string().refine(isCategoryIcon, "Biểu tượng không hợp lệ."),
  type: txType,
});

export async function createCategoryAction(input: unknown): Promise<ActionResult<{ id: string }>> {
  return safeAction(async () => {
    const me = await requireMemberForAction();
    const d = categorySchema.parse(input);
    await ensureDefaultCategories(me.id);
    const dup = await one(
      "SELECT id FROM fin_categories WHERE member_id = ? AND type = ? AND lower(name) = lower(?) AND archived = 0",
      [me.id, d.type, d.name],
    );
    if (dup) throw new ActionError("Danh mục này đã tồn tại.");
    const newId = randomUUID();
    await run("INSERT INTO fin_categories (id, member_id, name, icon, type, created_at) VALUES (?, ?, ?, ?, ?, ?)", [
      newId,
      me.id,
      d.name,
      d.icon,
      d.type,
      new Date().toISOString(),
    ]);
    refresh();
    return { id: newId };
  });
}

export async function updateCategoryAction(catId: string, input: unknown): Promise<ActionResult> {
  return safeAction(async () => {
    const me = await requireMemberForAction();
    id.parse(catId);
    const d = categorySchema.omit({ type: true }).parse(input);
    const n = await run("UPDATE fin_categories SET name = ?, icon = ? WHERE id = ? AND member_id = ?", [
      d.name,
      d.icon,
      catId,
      me.id,
    ]);
    if (n === 0) throw new ActionError("Không tìm thấy danh mục.");
    refresh();
    return undefined;
  });
}

/** Archive instead of delete: past transactions keep their category (BR-012 history). */
export async function archiveCategoryAction(catId: string): Promise<ActionResult> {
  return safeAction(async () => {
    const me = await requireMemberForAction();
    id.parse(catId);
    const cat = await getCategory(me.id, catId);
    if (!cat) throw new ActionError("Không tìm thấy danh mục.");
    const remaining = await one<{ n: number }>(
      "SELECT COUNT(*) AS n FROM fin_categories WHERE member_id = ? AND type = ? AND archived = 0",
      [me.id, cat.type],
    );
    if (Number(remaining?.n ?? 0) <= 1) throw new ActionError("Cần giữ ít nhất một danh mục cho mỗi loại.");
    await run("UPDATE fin_categories SET archived = 1 WHERE id = ? AND member_id = ?", [catId, me.id]);
    await run("DELETE FROM fin_budgets WHERE category_id = ? AND member_id = ? AND month >= ?", [
      catId,
      me.id,
      todayLocal().slice(0, 7),
    ]);
    refresh();
    return undefined;
  });
}

// ---------- Budgets (FIN-09..12) ----------

const budgetSchema = z.object({
  month: z.string().refine(isMonthKey, "Tháng không hợp lệ."),
  lines: z
    .array(z.object({ categoryId: id, limit: amount }))
    .min(1, "Thêm ít nhất một danh mục.")
    .max(50),
});

/** Create or replace limits for the given categories in one month (mockup 26). */
export async function saveBudgetsAction(input: unknown): Promise<ActionResult> {
  return safeAction(async () => {
    const me = await requireMemberForAction();
    const d = budgetSchema.parse(input);
    const ids = new Set(d.lines.map((l) => l.categoryId));
    if (ids.size !== d.lines.length) throw new ActionError("Mỗi danh mục chỉ đặt một hạn mức.");
    for (const l of d.lines) await assertCategory(me.id, l.categoryId, "expense");
    const now = new Date().toISOString();
    await tx(
      d.lines.map((l) => ({
        sql: `INSERT INTO fin_budgets (id, member_id, category_id, month, limit_amount, created_at)
              VALUES (?, ?, ?, ?, ?, ?)
              ON CONFLICT (member_id, category_id, month) DO UPDATE SET limit_amount = excluded.limit_amount`,
        args: [randomUUID(), me.id, l.categoryId, d.month, l.limit, now],
      })),
    );
    refresh();
    return undefined;
  });
}

export async function deleteBudgetAction(budgetId: string): Promise<ActionResult> {
  return safeAction(async () => {
    const me = await requireMemberForAction();
    id.parse(budgetId);
    const n = await run("DELETE FROM fin_budgets WHERE id = ? AND member_id = ?", [budgetId, me.id]);
    if (n === 0) throw new ActionError("Không tìm thấy ngân sách.");
    refresh();
    return undefined;
  });
}

/** Copy last month's limits into `month` (only categories not yet budgeted). */
export async function copyPreviousBudgetsAction(month: string): Promise<ActionResult<{ copied: number }>> {
  return safeAction(async () => {
    const me = await requireMemberForAction();
    if (!isMonthKey(month)) throw new ActionError("Tháng không hợp lệ.");
    const prev = await all<{ category_id: string; limit_amount: number }>(
      `SELECT b.category_id, b.limit_amount FROM fin_budgets b JOIN fin_categories c ON c.id = b.category_id
       WHERE b.member_id = ? AND b.month = ? AND c.archived = 0`,
      [me.id, shiftMonth(month, -1)],
    );
    if (prev.length === 0) throw new ActionError("Tháng trước chưa có ngân sách để sao chép.");
    const now = new Date().toISOString();
    await tx(
      prev.map((p) => ({
        sql: `INSERT OR IGNORE INTO fin_budgets (id, member_id, category_id, month, limit_amount, created_at)
              VALUES (?, ?, ?, ?, ?, ?)`,
        args: [randomUUID(), me.id, p.category_id, month, Number(p.limit_amount), now],
      })),
    );
    refresh();
    return { copied: prev.length };
  });
}

// ---------- Saving goals (FIN-13..15) ----------

const goalSchema = z.object({
  name: z.string().trim().min(1, "Vui lòng nhập tên mục tiêu.").max(60),
  target: amount,
  current: z.coerce.number().int().min(0).max(MAX_AMOUNT_VND).default(0),
  deadline: localDate,
});

export async function createGoalAction(input: unknown): Promise<ActionResult<{ id: string }>> {
  return safeAction(async () => {
    const me = await requireMemberForAction();
    const d = goalSchema.parse(input);
    if (d.deadline < todayLocal()) throw new ActionError("Hạn hoàn thành phải từ hôm nay trở đi.");
    const newId = randomUUID();
    const now = new Date().toISOString();
    await run(
      `INSERT INTO fin_goals (id, member_id, name, target_amount, current_amount, deadline, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [newId, me.id, d.name, d.target, d.current, d.deadline, now, now],
    );
    refresh();
    return { id: newId };
  });
}

/** Add (positive) or withdraw (negative) money from a goal; never below zero. */
export async function adjustGoalAction(goalId: string, delta: number): Promise<ActionResult> {
  return safeAction(async () => {
    const me = await requireMemberForAction();
    id.parse(goalId);
    const d = z.number().int().refine((v) => v !== 0 && Math.abs(v) <= MAX_AMOUNT_VND, "Số tiền không hợp lệ.").parse(delta);
    const g = await getGoal(me.id, goalId);
    if (!g) throw new ActionError("Không tìm thấy mục tiêu.");
    if (g.current + d < 0) throw new ActionError("Số tiền rút lớn hơn số đã tiết kiệm.");
    await run("UPDATE fin_goals SET current_amount = ?, updated_at = ? WHERE id = ? AND member_id = ?", [
      g.current + d,
      new Date().toISOString(),
      goalId,
      me.id,
    ]);
    refresh();
    return undefined;
  });
}

export async function deleteGoalAction(goalId: string): Promise<ActionResult> {
  return safeAction(async () => {
    const me = await requireMemberForAction();
    id.parse(goalId);
    const n = await run("DELETE FROM fin_goals WHERE id = ? AND member_id = ?", [goalId, me.id]);
    if (n === 0) throw new ActionError("Không tìm thấy mục tiêu.");
    refresh();
    return undefined;
  });
}

// ---------- Saving challenges (FIN-16/17) ----------

const challengeSchema = z.object({
  title: z.string().trim().min(1, "Vui lòng nhập tên thử thách.").max(60),
  type: z.enum(["saving", "spending_limit"]),
  target: amount,
  durationDays: z.coerce.number().int().min(1, "Ít nhất 1 ngày.").max(365, "Tối đa 365 ngày."),
});

export async function createChallengeAction(input: unknown): Promise<ActionResult<{ id: string }>> {
  return safeAction(async () => {
    const me = await requireMemberForAction();
    const d = challengeSchema.parse(input);
    const newId = randomUUID();
    await run(
      `INSERT INTO fin_challenges (id, member_id, title, challenge_type, target_amount, duration_days, start_date, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [newId, me.id, d.title, d.type, d.target, d.durationDays, todayLocal(), new Date().toISOString()],
    );
    refresh();
    return { id: newId };
  });
}

/** Daily check-in: recompute progress from transactions since the first check-in. */
export async function checkInChallengeAction(challengeId: string): Promise<ActionResult> {
  return safeAction(async () => {
    const me = await requireMemberForAction();
    id.parse(challengeId);
    const c = await getChallenge(me.id, challengeId);
    if (!c) throw new ActionError("Không tìm thấy thử thách.");
    if (c.status !== "active") throw new ActionError("Thử thách đã kết thúc.");
    const today = todayLocal();
    if (c.lastCheckIn === today) throw new ActionError("Hôm nay bạn đã check-in rồi.");
    const first = c.firstCheckIn ?? today;
    const txs = await all<{ type: "income" | "expense"; amount: number }>(
      "SELECT type, amount FROM fin_transactions WHERE member_id = ? AND occurred_at >= ? AND occurred_at < ?",
      [me.id, `${first}T00:00`, `${today}T24:00`],
    );
    const progress = challengeProgress(c.type, txs.map((t) => ({ type: t.type, amount: Number(t.amount) })));
    const checkedDays = c.checkedDays + 1;
    const status = evaluateChallengeStatus({
      challengeType: c.type,
      progressAmount: progress,
      targetAmount: c.target,
      checkedDays,
      durationDays: c.durationDays,
    });
    await run(
      `UPDATE fin_challenges SET first_check_in = ?, last_check_in = ?, checked_days = ?, progress_amount = ?, status = ?
       WHERE id = ? AND member_id = ?`,
      [first, today, checkedDays, progress, status, challengeId, me.id],
    );
    refresh();
    return undefined;
  });
}

export async function deleteChallengeAction(challengeId: string): Promise<ActionResult> {
  return safeAction(async () => {
    const me = await requireMemberForAction();
    id.parse(challengeId);
    const n = await run("DELETE FROM fin_challenges WHERE id = ? AND member_id = ?", [challengeId, me.id]);
    if (n === 0) throw new ActionError("Không tìm thấy thử thách.");
    refresh();
    return undefined;
  });
}

// ---------- CSV import (FIN-21..23) ----------

export type ImportSummary = { imported: number; createdCategories: string[]; errors: ImportError[] };

/**
 * dryRun=true validates and reports what would happen (FIN-22 preview).
 * dryRun=false writes everything in one transaction, or nothing if any row is invalid.
 */
export async function importCsvAction(text: string, dryRun: boolean): Promise<ActionResult<ImportSummary>> {
  return safeAction(async () => {
    const me = await requireMemberForAction();
    if (typeof text !== "string" || text.length > 2_000_000) throw new ActionError("Tệp quá lớn (tối đa 2 MB).");
    await ensureDefaultCategories(me.id);
    const { rows, errors } = validateImport(text);
    const cats = await all<{ id: string; name: string; type: string }>(
      "SELECT id, name, type FROM fin_categories WHERE member_id = ? AND archived = 0",
      [me.id],
    );
    const key = (type: string, name: string) => `${type}:${name.trim().toLowerCase()}`;
    const catMap = new Map(cats.map((c) => [key(c.type, c.name), c.id]));
    const toCreate = new Map<string, { id: string; name: string; type: string }>();
    for (const r of rows) {
      const k = key(r.type, r.category);
      if (!catMap.has(k) && !toCreate.has(k)) toCreate.set(k, { id: randomUUID(), name: r.category.trim(), type: r.type });
    }
    const summary = {
      imported: rows.length,
      createdCategories: [...toCreate.values()].map((c) => c.name),
      errors,
    };
    if (dryRun || errors.length > 0 || rows.length === 0) return { ...summary, imported: dryRun ? rows.length : 0 };

    const now = new Date().toISOString();
    await tx([
      ...[...toCreate.values()].map((c) => ({
        sql: "INSERT INTO fin_categories (id, member_id, name, icon, type, created_at) VALUES (?, ?, ?, 'more', ?, ?)",
        args: [c.id, me.id, c.name, c.type, now],
      })),
      ...rows.map((r) => ({
        sql: `INSERT INTO fin_transactions (id, member_id, type, amount, category_id, note, occurred_at, created_at, updated_at)
              VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        args: [
          randomUUID(),
          me.id,
          r.type,
          r.amount,
          catMap.get(key(r.type, r.category)) ?? toCreate.get(key(r.type, r.category))!.id,
          r.note,
          r.occurredAt,
          now,
          now,
        ],
      })),
    ]);
    await audit(me.id, "finance.import_csv", `rows:${rows.length}`, "success");
    refresh();
    return summary;
  });
}

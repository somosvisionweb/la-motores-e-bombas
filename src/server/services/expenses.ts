import { asc, desc, eq, sql } from 'drizzle-orm';
import type { PaymentMethod } from '@/config/payment-methods';
import type { ISODate } from '@/lib/dates';
import { normalizeSearch } from '@/lib/text';
import { BusinessError, NotFoundError } from '../auth/errors';
import type { Actor } from '../auth/types';
import { getDb, isUniqueViolation, runWrite } from '../db/client';
import { expenseCategories, expenses, type Expense, type ExpenseCategory } from '../db/schema';
import { audit } from './audit';
import { allOf, type PageResult } from './query-utils';

export interface ExpenseInput {
  date: ISODate;
  description: string;
  supplier: string | null;
  categoryId: number;
  amountCents: number;
  paymentMethod: PaymentMethod | null;
  notes: string | null;
}

async function assertCategory(categoryId: number): Promise<void> {
  const [row] = await getDb().select({ id: expenseCategories.id }).from(expenseCategories).where(eq(expenseCategories.id, categoryId)).limit(1);
  if (!row) throw new BusinessError('Categoria não encontrada.', 'categoryId');
}

export async function createExpense(input: ExpenseInput, actor: Actor, opts: { isDemo?: boolean; createdAt?: Date } = {}): Promise<Expense> {
  await assertCategory(input.categoryId);
  return runWrite(async (tx) => {
    const [created] = await tx
      .insert(expenses)
      .values({ ...input, isDemo: opts.isDemo ?? false, createdBy: actor.id, ...(opts.createdAt ? { createdAt: opts.createdAt, updatedAt: opts.createdAt } : {}) })
      .returning();
    await audit({ actor, action: 'EXPENSE_CREATE', entityType: 'expenses', entityId: created!.id, summary: `Custo lançado: ${input.description}` });
    return created!;
  });
}

export async function updateExpense(id: number, input: ExpenseInput, actor: Actor): Promise<Expense> {
  await assertCategory(input.categoryId);
  return runWrite(async (tx) => {
    const [existing] = await tx.select().from(expenses).where(eq(expenses.id, id)).limit(1);
    if (!existing) throw new NotFoundError('Custo');
    const [updated] = await tx.update(expenses).set(input).where(eq(expenses.id, id)).returning();
    await audit({ actor, action: 'EXPENSE_UPDATE', entityType: 'expenses', entityId: id, summary: `Custo atualizado: ${input.description}` });
    return updated!;
  });
}

export async function deleteExpense(id: number, actor: Actor): Promise<void> {
  await runWrite(async (tx) => {
    const [existing] = await tx.select().from(expenses).where(eq(expenses.id, id)).limit(1);
    if (!existing) throw new NotFoundError('Custo');
    await tx.delete(expenses).where(eq(expenses.id, id));
    await audit({ actor, action: 'EXPENSE_DELETE', entityType: 'expenses', entityId: id, summary: `Custo excluído: ${existing.description} (${existing.amountCents / 100})` });
  });
}

export async function getExpense(id: number): Promise<Expense | null> {
  const [row] = await getDb().select().from(expenses).where(eq(expenses.id, id)).limit(1);
  return row ?? null;
}

export interface ExpenseRow extends Expense {
  categoryName: string;
  isGoods: boolean;
}

export const EXPENSE_SORT_KEYS = ['date', 'amount', 'category'] as const;

export async function listExpenses(params: {
  from?: ISODate;
  to?: ISODate;
  categoryId?: number;
  q?: string;
  sort?: (typeof EXPENSE_SORT_KEYS)[number];
  dir?: 'asc' | 'desc';
  page?: number;
  pageSize?: number;
}): Promise<PageResult<ExpenseRow> & { totalCents: number }> {
  const db = getDb();
  const pageSize = params.pageSize ?? 20;
  const page = Math.max(1, params.page ?? 1);
  const q = normalizeSearch(params.q);
  const where = allOf(
    params.from ? sql`${expenses.date} >= ${params.from}` : undefined,
    params.to ? sql`${expenses.date} <= ${params.to}` : undefined,
    params.categoryId ? eq(expenses.categoryId, params.categoryId) : undefined,
    q ? sql`(lower(${expenses.description}) LIKE ${`%${q}%`} OR lower(COALESCE(${expenses.supplier}, '')) LIKE ${`%${q}%`})` : undefined,
  );
  const dir = params.dir === 'asc' ? asc : desc;
  const sortColumn = { date: expenses.date, amount: expenses.amountCents, category: sql`${expenseCategories.name} COLLATE NOCASE` }[params.sort ?? 'date'];

  const rows = await db
    .select({ expense: expenses, categoryName: expenseCategories.name, isGoods: expenseCategories.isGoods })
    .from(expenses)
    .innerJoin(expenseCategories, eq(expenseCategories.id, expenses.categoryId))
    .where(where)
    .orderBy(dir(sortColumn), desc(expenses.id))
    .limit(pageSize)
    .offset((page - 1) * pageSize);

  const [totals] = await db
    .select({ n: sql<number>`count(*)`, sum: sql<number>`COALESCE(SUM(${expenses.amountCents}), 0)` })
    .from(expenses)
    .where(where);

  return {
    rows: rows.map((r) => ({ ...r.expense, categoryName: r.categoryName, isGoods: r.isGoods })),
    total: Number(totals?.n ?? 0),
    totalCents: Number(totals?.sum ?? 0),
  };
}

export async function listSuppliers(): Promise<string[]> {
  const rows = await getDb().selectDistinct({ supplier: expenses.supplier }).from(expenses).orderBy(asc(expenses.supplier));
  return rows.map((r) => r.supplier).filter((s): s is string => Boolean(s));
}

// ---------- categorias ----------

export async function listExpenseCategories(opts: { activeOnly?: boolean } = {}): Promise<(ExpenseCategory & { usage: number })[]> {
  const rows = await getDb()
    .select({
      category: expenseCategories,
      usage: sql<number>`(SELECT COUNT(*) FROM expenses e WHERE e.category_id = ${expenseCategories.id})`,
    })
    .from(expenseCategories)
    .where(opts.activeOnly ? eq(expenseCategories.isActive, true) : undefined)
    .orderBy(asc(expenseCategories.sortOrder), asc(expenseCategories.name));
  return rows.map((r) => ({ ...r.category, usage: Number(r.usage) }));
}

export async function saveExpenseCategory(input: { id?: number; name: string; isGoods: boolean }, actor: Actor): Promise<void> {
  try {
    await runWrite(async (tx) => {
      if (input.id) {
        const [existing] = await tx.select().from(expenseCategories).where(eq(expenseCategories.id, input.id)).limit(1);
        if (!existing) throw new NotFoundError('Categoria');
        await tx.update(expenseCategories).set({ name: input.name, isGoods: input.isGoods }).where(eq(expenseCategories.id, input.id));
      } else {
        const [max] = await tx.select({ n: sql<number>`COALESCE(MAX(${expenseCategories.sortOrder}), -1)` }).from(expenseCategories);
        await tx.insert(expenseCategories).values({ name: input.name, isGoods: input.isGoods, sortOrder: Number(max?.n ?? -1) + 1 });
      }
      await audit({ actor, action: 'EXPENSE_CATEGORY_SAVE', entityType: 'expense_categories', entityId: input.id ?? null, summary: `Categoria de custo: ${input.name}` });
    });
  } catch (error) {
    if (isUniqueViolation(error)) throw new BusinessError('Já existe uma categoria com este nome.', 'name');
    throw error;
  }
}

export async function deleteExpenseCategory(id: number, actor: Actor): Promise<void> {
  await runWrite(async (tx) => {
    const [existing] = await tx.select().from(expenseCategories).where(eq(expenseCategories.id, id)).limit(1);
    if (!existing) throw new NotFoundError('Categoria');
    const [used] = await tx.select({ n: sql<number>`count(*)` }).from(expenses).where(eq(expenses.categoryId, id));
    if (Number(used?.n) > 0) throw new BusinessError('Esta categoria já possui custos lançados e não pode ser excluída.');
    await tx.delete(expenseCategories).where(eq(expenseCategories.id, id));
    await audit({ actor, action: 'EXPENSE_CATEGORY_DELETE', entityType: 'expense_categories', entityId: id, summary: `Categoria excluída: ${existing.name}` });
  });
}

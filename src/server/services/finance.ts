/** Agregações financeiras (entradas = pagamentos recebidos; custos = despesas cadastradas). */
import { and, eq, sql } from 'drizzle-orm';
import type { PaymentMethod } from '@/config/payment-methods';
import type { ISODate } from '@/lib/dates';
import { getDb } from '../db/client';
import { customers, expenseCategories, expenses, payments, sales, serviceOrders } from '../db/schema';

export interface FinanceSummary {
  incomeCents: number;
  expenseCents: number;
  /** Custos de categorias marcadas como "mercadorias". */
  goodsCents: number;
  /** Entradas − custos cadastrados. */
  resultCents: number;
  paymentsCount: number;
  expensesCount: number;
}

const incomeIn = (from: ISODate, to: ISODate) => and(eq(payments.status, 'PAID'), sql`${payments.paidDate} >= ${from}`, sql`${payments.paidDate} <= ${to}`);
const expenseIn = (from: ISODate, to: ISODate) => and(sql`${expenses.date} >= ${from}`, sql`${expenses.date} <= ${to}`);

export async function getFinanceSummary(from: ISODate, to: ISODate): Promise<FinanceSummary> {
  const db = getDb();
  const [income] = await db
    .select({ sum: sql<number>`COALESCE(SUM(${payments.amountCents}), 0)`, n: sql<number>`count(*)` })
    .from(payments)
    .where(incomeIn(from, to));
  const [costs] = await db
    .select({
      sum: sql<number>`COALESCE(SUM(${expenses.amountCents}), 0)`,
      goods: sql<number>`COALESCE(SUM(CASE WHEN ${expenseCategories.isGoods} = 1 THEN ${expenses.amountCents} ELSE 0 END), 0)`,
      n: sql<number>`count(*)`,
    })
    .from(expenses)
    .innerJoin(expenseCategories, eq(expenseCategories.id, expenses.categoryId))
    .where(expenseIn(from, to));

  const incomeCents = Number(income?.sum ?? 0);
  const expenseCents = Number(costs?.sum ?? 0);
  return {
    incomeCents,
    expenseCents,
    goodsCents: Number(costs?.goods ?? 0),
    resultCents: incomeCents - expenseCents,
    paymentsCount: Number(income?.n ?? 0),
    expensesCount: Number(costs?.n ?? 0),
  };
}

export interface DailyPoint {
  date: ISODate;
  cents: number;
}

export async function getIncomeSeries(from: ISODate, to: ISODate): Promise<DailyPoint[]> {
  const rows = await getDb()
    .select({ date: payments.paidDate, cents: sql<number>`SUM(${payments.amountCents})` })
    .from(payments)
    .where(incomeIn(from, to))
    .groupBy(payments.paidDate)
    .orderBy(payments.paidDate);
  return rows.map((r) => ({ date: r.date, cents: Number(r.cents) }));
}

export async function getExpenseSeries(from: ISODate, to: ISODate): Promise<DailyPoint[]> {
  const rows = await getDb()
    .select({ date: expenses.date, cents: sql<number>`SUM(${expenses.amountCents})` })
    .from(expenses)
    .where(expenseIn(from, to))
    .groupBy(expenses.date)
    .orderBy(expenses.date);
  return rows.map((r) => ({ date: r.date, cents: Number(r.cents) }));
}

export async function getIncomeByMethod(from: ISODate, to: ISODate): Promise<{ method: PaymentMethod; cents: number; count: number }[]> {
  const rows = await getDb()
    .select({ method: payments.method, cents: sql<number>`SUM(${payments.amountCents})`, count: sql<number>`count(*)` })
    .from(payments)
    .where(incomeIn(from, to))
    .groupBy(payments.method);
  return rows.map((r) => ({ method: r.method, cents: Number(r.cents), count: Number(r.count) }));
}

export async function getExpenseByCategory(from: ISODate, to: ISODate): Promise<{ categoryId: number; name: string; cents: number; count: number; isGoods: boolean }[]> {
  const rows = await getDb()
    .select({
      categoryId: expenseCategories.id,
      name: expenseCategories.name,
      isGoods: expenseCategories.isGoods,
      cents: sql<number>`SUM(${expenses.amountCents})`,
      count: sql<number>`count(*)`,
    })
    .from(expenses)
    .innerJoin(expenseCategories, eq(expenseCategories.id, expenses.categoryId))
    .where(expenseIn(from, to))
    .groupBy(expenseCategories.id)
    .orderBy(sql`SUM(${expenses.amountCents}) DESC`);
  return rows.map((r) => ({ ...r, cents: Number(r.cents), count: Number(r.count) }));
}

/** Últimos pagamentos recebidos (dashboard). */
export async function listLatestPayments(limit = 8) {
  return getDb()
    .select({
      id: payments.id,
      paidDate: payments.paidDate,
      amountCents: payments.amountCents,
      method: payments.method,
      description: payments.description,
      customerName: customers.name,
      orderId: payments.orderId,
      orderNumber: serviceOrders.number,
      saleId: payments.saleId,
      saleNumber: sales.number,
      isDemo: payments.isDemo,
    })
    .from(payments)
    .leftJoin(customers, eq(customers.id, payments.customerId))
    .leftJoin(serviceOrders, eq(serviceOrders.id, payments.orderId))
    .leftJoin(sales, eq(sales.id, payments.saleId))
    .where(eq(payments.status, 'PAID'))
    .orderBy(sql`${payments.paidDate} DESC`, sql`${payments.id} DESC`)
    .limit(limit);
}

import { and, inArray, sql } from 'drizzle-orm';
import { COMPLETED_ORDER_STATUSES, OPEN_ORDER_STATUSES } from '@/config/order-status';
import type { PaymentMethod } from '@/config/payment-methods';
import { zonedDayBoundMs, type Period } from '@/lib/dates';
import { getDb } from '../db/client';
import { customers, serviceOrders } from '../db/schema';
import {
  getExpenseSeries,
  getFinanceSummary,
  getIncomeByMethod,
  getIncomeSeries,
  listLatestPayments,
  type FinanceSummary,
} from './finance';
import { listInProgressOrders, listRecentOrders } from './orders';
import { aggregateSeries, buildAxis, type BucketAxis } from './series';

export interface TopProduct {
  name: string;
  quantity: number;
  cents: number;
}

/** Produtos mais vendidos no período: vendas ativas + peças usadas em ordens não canceladas. */
export async function getTopProducts(from: string, to: string, limit = 8): Promise<TopProduct[]> {
  const rows = await getDb().all<{ name: string; qty: number; cents: number }>(sql`
    SELECT COALESCE(p.name, i.description) AS name, SUM(i.quantity) AS qty, SUM(i.total_cents) AS cents
    FROM (
      SELECT si.product_id AS product_id, si.description AS description, si.quantity AS quantity, si.total_cents AS total_cents
        FROM sale_items si JOIN sales s ON s.id = si.sale_id
       WHERE s.status = 'ACTIVE' AND si.is_fee = 0 AND s.sale_date >= ${from} AND s.sale_date <= ${to}
      UNION ALL
      SELECT oi.product_id, oi.description, oi.quantity, oi.total_cents
        FROM service_order_items oi JOIN service_orders o ON o.id = oi.order_id
       WHERE oi.kind = 'PART' AND o.status <> 'CANCELADO' AND o.entry_date >= ${from} AND o.entry_date <= ${to}
    ) i
    LEFT JOIN products p ON p.id = i.product_id
    GROUP BY COALESCE(CAST(p.id AS TEXT), 'txt:' || lower(i.description))
    ORDER BY qty DESC, cents DESC
    LIMIT ${limit}
  `);
  return rows.map((r) => ({ name: r.name, quantity: Number(r.qty), cents: Number(r.cents) }));
}

export interface DashboardData {
  period: Period;
  axis: BucketAxis;
  finance: null | {
    summary: FinanceSummary;
    incomeSeries: number[];
    expenseSeries: number[];
    byMethod: { method: PaymentMethod; cents: number; count: number }[];
    latestPayments: Awaited<ReturnType<typeof listLatestPayments>>;
  };
  services: { completedCount: number; completedSeries: number[] };
  openOrders: number;
  customersTotal: number;
  newCustomers: number;
  topProducts: TopProduct[];
  recentOrders: Awaited<ReturnType<typeof listRecentOrders>>;
  inProgress: Awaited<ReturnType<typeof listInProgressOrders>>;
}

export async function getDashboardData(period: Period, opts: { finance: boolean; timezone: string }): Promise<DashboardData> {
  const db = getDb();
  const { from, to } = period;
  const axis = buildAxis(from, to, period.days);
  const completed = COMPLETED_ORDER_STATUSES as string[];
  const startMs = zonedDayBoundMs(from, opts.timezone, 'start');
  const endMs = zonedDayBoundMs(to, opts.timezone, 'end');

  const [completedRows, [openRow], [customersRow], [newCustomersRow], topProducts, recentOrders, inProgress] = await Promise.all([
    db
      .select({ date: serviceOrders.completedDate, n: sql<number>`count(*)` })
      .from(serviceOrders)
      .where(and(inArray(serviceOrders.status, completed as never), sql`${serviceOrders.completedDate} >= ${from}`, sql`${serviceOrders.completedDate} <= ${to}`))
      .groupBy(serviceOrders.completedDate),
    db.select({ n: sql<number>`count(*)` }).from(serviceOrders).where(inArray(serviceOrders.status, OPEN_ORDER_STATUSES)),
    db.select({ n: sql<number>`count(*)` }).from(customers),
    db
      .select({ n: sql<number>`count(*)` })
      .from(customers)
      .where(and(sql`${customers.createdAt} >= ${startMs}`, sql`${customers.createdAt} <= ${endMs}`)),
    getTopProducts(from, to),
    listRecentOrders(6),
    listInProgressOrders(6),
  ]);

  const completedPoints = completedRows.filter((r) => r.date).map((r) => ({ date: r.date!, value: Number(r.n) }));

  let finance: DashboardData['finance'] = null;
  if (opts.finance) {
    const [summary, income, expense, byMethod, latestPayments] = await Promise.all([
      getFinanceSummary(from, to),
      getIncomeSeries(from, to),
      getExpenseSeries(from, to),
      getIncomeByMethod(from, to),
      listLatestPayments(6),
    ]);
    finance = {
      summary,
      incomeSeries: aggregateSeries(income.map((p) => ({ date: p.date, value: p.cents })), axis),
      expenseSeries: aggregateSeries(expense.map((p) => ({ date: p.date, value: p.cents })), axis),
      byMethod: byMethod.sort((a, b) => b.cents - a.cents),
      latestPayments,
    };
  }

  return {
    period,
    axis,
    finance,
    services: {
      completedCount: completedPoints.reduce((s, p) => s + p.value, 0),
      completedSeries: aggregateSeries(completedPoints, axis),
    },
    openOrders: Number(openRow?.n ?? 0),
    customersTotal: Number(customersRow?.n ?? 0),
    newCustomers: Number(newCustomersRow?.n ?? 0),
    topProducts,
    recentOrders,
    inProgress,
  };
}

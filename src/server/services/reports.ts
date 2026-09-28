/**
 * Relatórios: cada tipo devolve KPIs + tabelas + gráficos a partir dos mesmos dados.
 * A página, a impressão A4, o PDF e o CSV consomem esta estrutura (números idênticos em todos).
 */
import { and, desc, eq, inArray, sql } from 'drizzle-orm';
import { IN_PROGRESS_ORDER_STATUSES, ORDER_STATUS, ORDER_STATUS_KEYS } from '@/config/order-status';
import { PAYMENT_METHOD_KEYS, PAYMENT_METHOD_LABEL, PAYMENT_METHOD_SHORT } from '@/config/payment-methods';
import { formatOrderCode, formatSaleCode } from '@/lib/codes';
import { formatDateBR, zonedDayBoundMs, type Period } from '@/lib/dates';
import { formatBRL, formatInt, formatPercent, percentOf } from '@/lib/money';
import { displayPhone } from '@/lib/phone';
import type { Actor } from '../auth/types';
import { getDb, runWrite } from '../db/client';
import { customers, payments, reports, serviceOrderItems, serviceOrders } from '../db/schema';
import { audit } from './audit';
import { listExpenses } from './expenses';
import { getExpenseByCategory, getExpenseSeries, getFinanceSummary, getIncomeByMethod, getIncomeSeries } from './finance';
import { listOrders } from './orders';
import { listPayments } from './payments';
import { aggregateSeries, buildAxis } from './series';

export const REPORT_TYPES = ['entradas', 'custos', 'servicos', 'clientes', 'financeiro'] as const;
export type ReportType = (typeof REPORT_TYPES)[number];

export const REPORT_META: Record<ReportType, { title: string; description: string; permission: 'finance.view' | 'reports.view'; dbType: 'ENTRADAS' | 'CUSTOS' | 'SERVICOS' | 'CLIENTES' | 'FINANCEIRO' }> = {
  entradas: { title: 'Relatório de entradas', description: 'Total recebido no período, por forma de pagamento (PIX, cartão, dinheiro e boleto).', permission: 'finance.view', dbType: 'ENTRADAS' },
  custos: { title: 'Relatório de custos', description: 'Total de custos, custos ao longo do período e por categoria.', permission: 'finance.view', dbType: 'CUSTOS' },
  servicos: { title: 'Relatório de serviços', description: 'Quantidade de serviços, realizados, em andamento e finalizados.', permission: 'reports.view', dbType: 'SERVICOS' },
  clientes: { title: 'Relatório de clientes', description: 'Clientes cadastrados, novos e atendidos no período.', permission: 'reports.view', dbType: 'CLIENTES' },
  financeiro: { title: 'Relatório financeiro', description: 'Entradas − custos = resultado, por período.', permission: 'finance.view', dbType: 'FINANCEIRO' },
};

export function isReportType(value: unknown): value is ReportType {
  return typeof value === 'string' && (REPORT_TYPES as readonly string[]).includes(value);
}

export type Cell = string | number | null;
export type ColumnKind = 'text' | 'money' | 'int' | 'percent';

export interface ReportColumn {
  header: string;
  kind?: ColumnKind;
  align?: 'left' | 'right' | 'center';
  /** Peso relativo da largura no PDF. */
  width?: number;
}

export interface ReportTable {
  title: string;
  columns: ReportColumn[];
  rows: Cell[][];
  /** Linha de totais (mesma quantidade de colunas). */
  footer?: Cell[];
  note?: string;
}

export interface ReportKpi {
  label: string;
  value: string;
  hint?: string;
  tone?: 'positive' | 'negative';
}

export type ReportChart =
  | {
      kind: 'columns';
      title: string;
      subtitle?: string;
      categories: string[];
      fullLabels: string[];
      series: { key: string; label: string; color: 'navy' | 'green'; values: number[] }[];
      money: boolean;
    }
  | { kind: 'hbars'; title: string; subtitle?: string; rows: { label: string; value: number; sub?: string }[]; money: boolean; color: 'navy' | 'green'; showShare: boolean; valueHeader: string };

export interface ReportData {
  type: ReportType;
  title: string;
  period: Period;
  kpis: ReportKpi[];
  charts: ReportChart[];
  tables: ReportTable[];
  /** Resumo gravado no histórico de relatórios. */
  summary: Record<string, number>;
}

/** Formata uma célula conforme o tipo da coluna (tela, impressão e PDF). */
export function formatCell(column: ReportColumn, value: Cell): string {
  if (value === null || value === '') return '—';
  if (typeof value === 'string') return value;
  switch (column.kind) {
    case 'money':
      return formatBRL(value);
    case 'percent':
      return formatPercent(value);
    case 'int':
      return formatInt(value);
    default:
      return String(value);
  }
}

const MAX_ROWS = 1000;

// ---------------------------------------------------------------------------
// Entradas
// ---------------------------------------------------------------------------

async function incomeReport(period: Period): Promise<ReportData> {
  const { from, to } = period;
  const axis = buildAxis(from, to, period.days);
  const [summary, series, byMethod, list] = await Promise.all([
    getFinanceSummary(from, to),
    getIncomeSeries(from, to),
    getIncomeByMethod(from, to),
    listPayments({ from, to, pageSize: MAX_ROWS, sort: 'date', dir: 'asc' }),
  ]);
  const methodMap = new Map(byMethod.map((m) => [m.method, m]));
  const total = summary.incomeCents;

  return {
    type: 'entradas',
    title: REPORT_META.entradas.title,
    period,
    kpis: [
      { label: 'Total recebido', value: formatBRL(total), tone: 'positive' },
      ...PAYMENT_METHOD_KEYS.map((m) => ({ label: PAYMENT_METHOD_SHORT[m], value: formatBRL(methodMap.get(m)?.cents ?? 0), hint: `${methodMap.get(m)?.count ?? 0} pagamento(s)` })),
    ],
    charts: [
      {
        kind: 'columns',
        title: 'Entradas por período',
        categories: axis.labels,
        fullLabels: axis.fullLabels,
        series: [{ key: 'income', label: 'Entradas', color: 'green', values: aggregateSeries(series.map((p) => ({ date: p.date, value: p.cents })), axis) }],
        money: true,
      },
      {
        kind: 'hbars',
        title: 'Por forma de pagamento',
        rows: PAYMENT_METHOD_KEYS.map((m) => ({ label: PAYMENT_METHOD_SHORT[m], value: methodMap.get(m)?.cents ?? 0, sub: `${methodMap.get(m)?.count ?? 0} pagamento(s)` })).sort((a, b) => b.value - a.value),
        money: true,
        color: 'green',
        showShare: true,
        valueHeader: 'Recebido',
      },
    ],
    tables: [
      {
        title: 'Resumo por forma de pagamento',
        columns: [
          { header: 'Forma de pagamento', width: 3 },
          { header: 'Pagamentos', kind: 'int', align: 'right', width: 1.5 },
          { header: 'Total', kind: 'money', align: 'right', width: 2 },
          { header: '%', kind: 'percent', align: 'right', width: 1 },
        ],
        rows: PAYMENT_METHOD_KEYS.map((m) => [PAYMENT_METHOD_LABEL[m], methodMap.get(m)?.count ?? 0, methodMap.get(m)?.cents ?? 0, percentOf(methodMap.get(m)?.cents ?? 0, total)]),
        footer: ['Total', summary.paymentsCount, total, total > 0 ? 100 : 0],
      },
      {
        title: 'Pagamentos recebidos',
        columns: [
          { header: 'Data', width: 1.3 },
          { header: 'Cliente', width: 3 },
          { header: 'Referência', width: 2.6 },
          { header: 'Forma', width: 1.4 },
          { header: 'Valor', kind: 'money', align: 'right', width: 1.6 },
        ],
        rows: list.rows.map((p) => [
          formatDateBR(p.paidDate),
          p.customerName ?? '—',
          p.orderNumber ? formatOrderCode(p.orderNumber) : p.saleNumber ? formatSaleCode(p.saleNumber) : p.description,
          PAYMENT_METHOD_SHORT[p.method],
          p.amountCents,
        ]),
        footer: ['', '', '', 'Total', total],
        note: list.total > MAX_ROWS ? `Exibindo os primeiros ${MAX_ROWS} de ${list.total} pagamentos. Use um período menor para ver todos.` : undefined,
      },
    ],
    summary: { totalCents: total, payments: summary.paymentsCount },
  };
}

// ---------------------------------------------------------------------------
// Custos
// ---------------------------------------------------------------------------

async function expenseReport(period: Period): Promise<ReportData> {
  const { from, to } = period;
  const axis = buildAxis(from, to, period.days);
  const [summary, series, byCategory, list] = await Promise.all([
    getFinanceSummary(from, to),
    getExpenseSeries(from, to),
    getExpenseByCategory(from, to),
    listExpenses({ from, to, pageSize: MAX_ROWS, sort: 'date', dir: 'asc' }),
  ]);
  const total = summary.expenseCents;

  return {
    type: 'custos',
    title: REPORT_META.custos.title,
    period,
    kpis: [
      { label: 'Total de custos', value: formatBRL(total) },
      { label: 'Custo de mercadorias', value: formatBRL(summary.goodsCents) },
      { label: 'Lançamentos', value: formatInt(summary.expensesCount) },
      { label: 'Maior categoria', value: byCategory[0] ? byCategory[0].name : '—', hint: byCategory[0] ? formatBRL(byCategory[0].cents) : undefined },
    ],
    charts: [
      {
        kind: 'columns',
        title: 'Custos por período',
        categories: axis.labels,
        fullLabels: axis.fullLabels,
        series: [{ key: 'expense', label: 'Custos', color: 'navy', values: aggregateSeries(series.map((p) => ({ date: p.date, value: p.cents })), axis) }],
        money: true,
      },
      { kind: 'hbars', title: 'Por categoria', rows: byCategory.map((c) => ({ label: c.name, value: c.cents, sub: `${c.count} lançamento(s)` })), money: true, color: 'navy', showShare: true, valueHeader: 'Custo' },
    ],
    tables: [
      {
        title: 'Custos por categoria',
        columns: [
          { header: 'Categoria', width: 3 },
          { header: 'Lançamentos', kind: 'int', align: 'right', width: 1.5 },
          { header: 'Total', kind: 'money', align: 'right', width: 2 },
          { header: '%', kind: 'percent', align: 'right', width: 1 },
        ],
        rows: byCategory.map((c) => [c.isGoods ? `${c.name} (mercadorias)` : c.name, c.count, c.cents, percentOf(c.cents, total)]),
        footer: ['Total', summary.expensesCount, total, total > 0 ? 100 : 0],
      },
      {
        title: 'Custos lançados',
        columns: [
          { header: 'Data', width: 1.3 },
          { header: 'Descrição', width: 3.2 },
          { header: 'Fornecedor', width: 2 },
          { header: 'Categoria', width: 2 },
          { header: 'Valor', kind: 'money', align: 'right', width: 1.6 },
        ],
        rows: list.rows.map((e) => [formatDateBR(e.date), e.description, e.supplier ?? '—', e.categoryName, e.amountCents]),
        footer: ['', '', '', 'Total', total],
        note: list.total > MAX_ROWS ? `Exibindo os primeiros ${MAX_ROWS} de ${list.total} lançamentos.` : undefined,
      },
    ],
    summary: { totalCents: total, goodsCents: summary.goodsCents, count: summary.expensesCount },
  };
}

// ---------------------------------------------------------------------------
// Serviços
// ---------------------------------------------------------------------------

async function servicesReport(period: Period, today: string): Promise<ReportData> {
  const { from, to } = period;
  const db = getDb();
  const inProgress = IN_PROGRESS_ORDER_STATUSES as string[];

  const [statusRows, [realized], [finalized], [inProgressRow], topServices, list] = await Promise.all([
    db
      .select({ status: serviceOrders.status, n: sql<number>`count(*)` })
      .from(serviceOrders)
      .where(and(sql`${serviceOrders.entryDate} >= ${from}`, sql`${serviceOrders.entryDate} <= ${to}`))
      .groupBy(serviceOrders.status),
    db
      .select({ n: sql<number>`count(*)` })
      .from(serviceOrders)
      .where(and(inArray(serviceOrders.status, ['PRONTO', 'ENTREGUE']), sql`${serviceOrders.completedDate} >= ${from}`, sql`${serviceOrders.completedDate} <= ${to}`)),
    db
      .select({ n: sql<number>`count(*)` })
      .from(serviceOrders)
      .where(and(eq(serviceOrders.status, 'ENTREGUE'), sql`${serviceOrders.deliveredDate} >= ${from}`, sql`${serviceOrders.deliveredDate} <= ${to}`)),
    db
      .select({ n: sql<number>`count(*)` })
      .from(serviceOrders)
      .where(and(inArray(serviceOrders.status, inProgress as never), sql`${serviceOrders.entryDate} >= ${from}`, sql`${serviceOrders.entryDate} <= ${to}`)),
    db
      .select({ name: serviceOrderItems.description, n: sql<number>`count(*)`, cents: sql<number>`COALESCE(SUM(${serviceOrderItems.totalCents}), 0)` })
      .from(serviceOrderItems)
      .innerJoin(serviceOrders, eq(serviceOrders.id, serviceOrderItems.orderId))
      .where(and(eq(serviceOrderItems.kind, 'SERVICE'), sql`${serviceOrders.status} <> 'CANCELADO'`, sql`${serviceOrders.entryDate} >= ${from}`, sql`${serviceOrders.entryDate} <= ${to}`))
      .groupBy(serviceOrderItems.description)
      .orderBy(desc(sql`count(*)`), desc(sql`SUM(${serviceOrderItems.totalCents})`))
      .limit(15),
    listOrders({ from, to, today, pageSize: MAX_ROWS, sort: 'entry', dir: 'asc' }),
  ]);

  const byStatus = new Map(statusRows.map((r) => [r.status, Number(r.n)]));
  const totalOrders = [...byStatus.entries()].filter(([s]) => s !== 'CANCELADO').reduce((sum, [, n]) => sum + n, 0);
  const canceled = byStatus.get('CANCELADO') ?? 0;

  return {
    type: 'servicos',
    title: REPORT_META.servicos.title,
    period,
    kpis: [
      { label: 'Serviços (ordens abertas)', value: formatInt(totalOrders), hint: `${canceled} cancelada(s)` },
      { label: 'Serviços realizados', value: formatInt(Number(realized?.n ?? 0)), hint: 'Concluídos no período' },
      { label: 'Em andamento', value: formatInt(Number(inProgressRow?.n ?? 0)), hint: 'Ordens do período ainda abertas' },
      { label: 'Finalizados (entregues)', value: formatInt(Number(finalized?.n ?? 0)), hint: 'Entregues no período' },
    ],
    charts: [
      {
        kind: 'hbars',
        title: 'Ordens por situação',
        subtitle: 'Ordens com entrada no período',
        rows: ORDER_STATUS_KEYS.map((s) => ({ label: ORDER_STATUS[s].label, value: byStatus.get(s) ?? 0 })).filter((r) => r.value > 0),
        money: false,
        color: 'navy',
        showShare: true,
        valueHeader: 'Ordens',
      },
      {
        kind: 'hbars',
        title: 'Serviços mais realizados',
        rows: topServices.map((s) => ({ label: s.name, value: Number(s.n), sub: formatBRL(Number(s.cents)) })),
        money: false,
        color: 'green',
        showShare: false,
        valueHeader: 'Quantidade',
      },
    ],
    tables: [
      {
        title: 'Serviços mais realizados',
        columns: [
          { header: 'Serviço', width: 5 },
          { header: 'Qtd.', kind: 'int', align: 'right', width: 1 },
          { header: 'Valor', kind: 'money', align: 'right', width: 2 },
        ],
        rows: topServices.map((s) => [s.name, Number(s.n), Number(s.cents)]),
      },
      {
        title: 'Ordens de serviço do período',
        columns: [
          { header: 'OS', width: 1.4 },
          { header: 'Entrada', width: 1.3 },
          { header: 'Cliente', width: 2.6 },
          { header: 'Equipamento', width: 2.4 },
          { header: 'Status', width: 2 },
          { header: 'Total', kind: 'money', align: 'right', width: 1.6 },
        ],
        rows: list.rows.map((o) => [formatOrderCode(o.number), formatDateBR(o.entryDate), o.customerName, o.equipment, ORDER_STATUS[o.status].label, o.totalCents]),
        footer: ['', '', '', '', 'Total', list.rows.filter((o) => o.status !== 'CANCELADO').reduce((s, o) => s + o.totalCents, 0)],
        note: list.total > MAX_ROWS ? `Exibindo as primeiras ${MAX_ROWS} de ${list.total} ordens.` : 'O total exclui ordens canceladas.',
      },
    ],
    summary: { orders: totalOrders, realized: Number(realized?.n ?? 0), inProgress: Number(inProgressRow?.n ?? 0), finalized: Number(finalized?.n ?? 0) },
  };
}

// ---------------------------------------------------------------------------
// Clientes
// ---------------------------------------------------------------------------

async function customersReport(period: Period, timezone: string): Promise<ReportData> {
  const { from, to } = period;
  const db = getDb();
  const startMs = zonedDayBoundMs(from, timezone, 'start');
  const endMs = zonedDayBoundMs(to, timezone, 'end');

  const [[totalRow], newRows, [attendedRow], topByRevenue] = await Promise.all([
    db.select({ n: sql<number>`count(*)` }).from(customers),
    db
      .select({
        id: customers.id,
        name: customers.name,
        phone: customers.phone,
        createdAt: customers.createdAt,
        orders: sql<number>`(SELECT COUNT(*) FROM service_orders o WHERE o.customer_id = ${customers.id} AND o.status <> 'CANCELADO')`,
      })
      .from(customers)
      .where(and(sql`${customers.createdAt} >= ${startMs}`, sql`${customers.createdAt} <= ${endMs}`))
      .orderBy(customers.createdAt)
      .limit(MAX_ROWS),
    db.all<{ n: number }>(sql`
      SELECT COUNT(DISTINCT customer_id) AS n FROM (
        SELECT customer_id FROM service_orders WHERE entry_date >= ${from} AND entry_date <= ${to} AND status <> 'CANCELADO'
        UNION
        SELECT customer_id FROM sales WHERE sale_date >= ${from} AND sale_date <= ${to} AND status = 'ACTIVE' AND customer_id IS NOT NULL
      )`),
    db
      .select({ id: customers.id, name: customers.name, cents: sql<number>`SUM(${payments.amountCents})`, n: sql<number>`count(*)` })
      .from(payments)
      .innerJoin(customers, eq(customers.id, payments.customerId))
      .where(and(eq(payments.status, 'PAID'), sql`${payments.paidDate} >= ${from}`, sql`${payments.paidDate} <= ${to}`))
      .groupBy(customers.id)
      .orderBy(desc(sql`SUM(${payments.amountCents})`))
      .limit(10),
  ]);

  const attended = Number((attendedRow as unknown as { n: number } | undefined)?.n ?? 0);

  return {
    type: 'clientes',
    title: REPORT_META.clientes.title,
    period,
    kpis: [
      { label: 'Clientes cadastrados', value: formatInt(Number(totalRow?.n ?? 0)), hint: 'Total na base' },
      { label: 'Novos clientes', value: formatInt(newRows.length), hint: 'Cadastrados no período' },
      { label: 'Clientes atendidos', value: formatInt(attended), hint: 'Com ordem ou compra no período' },
    ],
    charts: [
      { kind: 'hbars', title: 'Clientes que mais pagaram', subtitle: 'No período', rows: topByRevenue.map((c) => ({ label: c.name, value: Number(c.cents), sub: `${c.n} pagamento(s)` })), money: true, color: 'green', showShare: false, valueHeader: 'Recebido' },
    ],
    tables: [
      {
        title: 'Clientes que mais pagaram',
        columns: [
          { header: 'Cliente', width: 5 },
          { header: 'Pagamentos', kind: 'int', align: 'right', width: 1.5 },
          { header: 'Total', kind: 'money', align: 'right', width: 2 },
        ],
        rows: topByRevenue.map((c) => [c.name, Number(c.n), Number(c.cents)]),
      },
      {
        title: 'Novos clientes no período',
        columns: [
          { header: 'Cadastro', width: 1.4 },
          { header: 'Cliente', width: 4 },
          { header: 'Telefone', width: 2 },
          { header: 'Ordens', kind: 'int', align: 'right', width: 1 },
        ],
        rows: newRows.map((c) => [formatDateBR(c.createdAt.toISOString().slice(0, 10)), c.name, displayPhone(c.phone) || '—', Number(c.orders)]),
      },
    ],
    summary: { total: Number(totalRow?.n ?? 0), new: newRows.length, attended },
  };
}

// ---------------------------------------------------------------------------
// Financeiro
// ---------------------------------------------------------------------------

async function financialReport(period: Period): Promise<ReportData> {
  const { from, to } = period;
  const axis = buildAxis(from, to, period.days);
  const [summary, income, expense, byMethod, byCategory] = await Promise.all([
    getFinanceSummary(from, to),
    getIncomeSeries(from, to),
    getExpenseSeries(from, to),
    getIncomeByMethod(from, to),
    getExpenseByCategory(from, to),
  ]);
  const incomeValues = aggregateSeries(income.map((p) => ({ date: p.date, value: p.cents })), axis);
  const expenseValues = aggregateSeries(expense.map((p) => ({ date: p.date, value: p.cents })), axis);

  return {
    type: 'financeiro',
    title: REPORT_META.financeiro.title,
    period,
    kpis: [
      { label: 'Entradas', value: formatBRL(summary.incomeCents), tone: 'positive' },
      { label: 'Custos', value: formatBRL(summary.expenseCents) },
      { label: 'Resultado', value: formatBRL(summary.resultCents), hint: 'Entradas − custos', tone: summary.resultCents < 0 ? 'negative' : 'positive' },
      { label: 'Custo de mercadorias', value: formatBRL(summary.goodsCents) },
    ],
    charts: [
      {
        kind: 'columns',
        title: 'Entradas × custos',
        categories: axis.labels,
        fullLabels: axis.fullLabels,
        series: [
          { key: 'income', label: 'Entradas', color: 'green', values: incomeValues },
          { key: 'expense', label: 'Custos', color: 'navy', values: expenseValues },
        ],
        money: true,
      },
    ],
    tables: [
      {
        title: 'Entradas − custos = resultado',
        columns: [
          { header: 'Período', width: 3 },
          { header: 'Entradas', kind: 'money', align: 'right', width: 2 },
          { header: 'Custos', kind: 'money', align: 'right', width: 2 },
          { header: 'Resultado', kind: 'money', align: 'right', width: 2 },
        ],
        rows: axis.fullLabels.map((label, i) => [label, incomeValues[i] ?? 0, expenseValues[i] ?? 0, (incomeValues[i] ?? 0) - (expenseValues[i] ?? 0)]),
        footer: ['Total', summary.incomeCents, summary.expenseCents, summary.resultCents],
      },
      {
        title: 'Entradas por forma de pagamento',
        columns: [
          { header: 'Forma', width: 3 },
          { header: 'Total', kind: 'money', align: 'right', width: 2 },
        ],
        rows: PAYMENT_METHOD_KEYS.map((m) => [PAYMENT_METHOD_LABEL[m], byMethod.find((x) => x.method === m)?.cents ?? 0]),
      },
      {
        title: 'Custos por categoria',
        columns: [
          { header: 'Categoria', width: 3 },
          { header: 'Total', kind: 'money', align: 'right', width: 2 },
        ],
        rows: byCategory.map((c) => [c.name, c.cents]),
      },
    ],
    summary: { incomeCents: summary.incomeCents, expenseCents: summary.expenseCents, resultCents: summary.resultCents },
  };
}

export async function buildReport(type: ReportType, period: Period, ctx: { today: string; timezone: string }): Promise<ReportData> {
  switch (type) {
    case 'entradas':
      return incomeReport(period);
    case 'custos':
      return expenseReport(period);
    case 'servicos':
      return servicesReport(period, ctx.today);
    case 'clientes':
      return customersReport(period, ctx.timezone);
    case 'financeiro':
      return financialReport(period);
  }
}

/** Registra no histórico (tabela `reports`) que um relatório foi visualizado/impresso/exportado. */
export async function recordReport(report: ReportData, format: 'VIEW' | 'PRINT' | 'PDF' | 'CSV', actor: Actor): Promise<void> {
  await runWrite(async (tx) => {
    await tx.insert(reports).values({
      type: REPORT_META[report.type].dbType,
      title: report.title,
      periodStart: report.period.from,
      periodEnd: report.period.to,
      format,
      params: { period: report.period.key },
      summary: report.summary,
      generatedBy: actor.id,
    });
    if (format !== 'VIEW') await audit({ actor, action: `REPORT_${format}`, entityType: 'reports', summary: `${report.title} (${report.period.from} a ${report.period.to})` });
  });
}

export async function listRecentReports(limit = 8) {
  return getDb().select().from(reports).where(sql`${reports.format} <> 'VIEW'`).orderBy(desc(reports.createdAt)).limit(limit);
}

/** CSV para Excel em português: separador ";", vírgula decimal, UTF-8 com BOM. */
export function reportToCsv(report: ReportData): string {
  // Texto que começa com = + - @ seria executado como fórmula ao abrir no Excel ("CSV injection"): prefixa aspa simples.
  const esc = (raw: string) => {
    const value = /^[=+\-@\t\r]/.test(raw) ? `'${raw}` : raw;
    return /[";\r\n]/.test(value) ? `"${value.replace(/"/g, '""')}"` : value;
  };
  const cellCsv = (column: ReportColumn | undefined, value: Cell): string => {
    if (value === null) return '';
    if (typeof value === 'number') {
      if (column?.kind === 'money') return (value / 100).toFixed(2).replace('.', ',');
      if (column?.kind === 'percent') return value.toFixed(1).replace('.', ',');
      return String(value);
    }
    return esc(value);
  };
  const lines: string[] = [esc(report.title), esc(`Período: ${report.period.from} a ${report.period.to}`), ''];
  for (const kpi of report.kpis) lines.push(`${esc(kpi.label)};${esc(kpi.value)}`);
  for (const table of report.tables) {
    lines.push('', esc(table.title), table.columns.map((c) => esc(c.header)).join(';'));
    for (const row of table.rows) lines.push(row.map((cell, i) => cellCsv(table.columns[i], cell)).join(';'));
    if (table.footer) lines.push(table.footer.map((cell, i) => cellCsv(table.columns[i], cell)).join(';'));
  }
  return `﻿${lines.join('\r\n')}\r\n`;
}

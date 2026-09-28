import { and, asc, desc, eq, sql } from 'drizzle-orm';
import type { PaymentMethod } from '@/config/payment-methods';
import { PAYMENT_METHOD_LABEL } from '@/config/payment-methods';
import { formatOrderCode, formatSaleCode } from '@/lib/codes';
import type { ISODate } from '@/lib/dates';
import { formatBRL } from '@/lib/money';
import { normalizeSearch } from '@/lib/text';
import { BusinessError, NotFoundError } from '../auth/errors';
import type { Actor } from '../auth/types';
import { getDb, runWrite } from '../db/client';
import { customers, payments, sales, serviceOrderEvents, serviceOrders, type Payment } from '../db/schema';
import { audit } from './audit';
import type { PageResult } from './query-utils';
import { allOf } from './query-utils';

/** Total já recebido (pagamentos não estornados) de uma OS, como subconsulta SQL reutilizável. */
export const orderPaidSql = sql<number>`COALESCE((SELECT SUM(p.amount_cents) FROM payments p WHERE p.order_id = ${serviceOrders.id} AND p.status = 'PAID'), 0)`;
export const salePaidSql = sql<number>`COALESCE((SELECT SUM(p.amount_cents) FROM payments p WHERE p.sale_id = ${sales.id} AND p.status = 'PAID'), 0)`;

export interface PaymentInput {
  orderId?: number | null;
  saleId?: number | null;
  customerId?: number | null;
  description?: string | null;
  amountCents: number;
  method: PaymentMethod;
  paidDate: ISODate;
  notes?: string | null;
}

/** Registra uma entrada. Vinculada a uma OS/venda, não pode exceder o saldo a receber. */
export async function registerPayment(
  input: PaymentInput,
  actor: Actor | null,
  opts: { isDemo?: boolean; allowOverpay?: boolean; createdAt?: Date } = {},
): Promise<Payment> {
  if (!Number.isInteger(input.amountCents) || input.amountCents <= 0) throw new BusinessError('Informe um valor maior que zero.', 'amountCents');
  if (input.orderId && input.saleId) throw new BusinessError('Um pagamento não pode pertencer a uma OS e a uma venda ao mesmo tempo.');

  return runWrite(async (tx) => {
    let customerId = input.customerId ?? null;
    let description = input.description?.trim() || '';

    if (input.orderId) {
      const [order] = await tx.select().from(serviceOrders).where(eq(serviceOrders.id, input.orderId)).limit(1);
      if (!order) throw new NotFoundError('Ordem de serviço');
      if (order.status === 'CANCELADO') throw new BusinessError('Não é possível registrar pagamento em uma OS cancelada.');
      const [paid] = await tx
        .select({ n: sql<number>`COALESCE(SUM(${payments.amountCents}), 0)` })
        .from(payments)
        .where(and(eq(payments.orderId, order.id), eq(payments.status, 'PAID')));
      const balance = order.totalCents - Number(paid?.n ?? 0);
      if (!opts.allowOverpay && input.amountCents > balance) {
        throw new BusinessError(
          balance <= 0 ? 'Esta ordem já está totalmente paga.' : `O valor excede o saldo a receber (${formatBRL(balance)}).`,
          'amountCents',
        );
      }
      customerId = order.customerId;
      description ||= `Pagamento ${formatOrderCode(order.number)}`;
    } else if (input.saleId) {
      const [sale] = await tx.select().from(sales).where(eq(sales.id, input.saleId)).limit(1);
      if (!sale) throw new NotFoundError('Venda');
      if (sale.status === 'CANCELED') throw new BusinessError('Não é possível registrar pagamento em uma venda cancelada.');
      const [paid] = await tx
        .select({ n: sql<number>`COALESCE(SUM(${payments.amountCents}), 0)` })
        .from(payments)
        .where(and(eq(payments.saleId, sale.id), eq(payments.status, 'PAID')));
      const balance = sale.totalCents - Number(paid?.n ?? 0);
      if (!opts.allowOverpay && input.amountCents > balance) {
        throw new BusinessError(
          balance <= 0 ? 'Esta venda já está totalmente paga.' : `O valor excede o saldo a receber (${formatBRL(balance)}).`,
          'amountCents',
        );
      }
      customerId = sale.customerId;
      description ||= `Pagamento ${formatSaleCode(sale.number)}`;
    }

    const [created] = await tx
      .insert(payments)
      .values({
        orderId: input.orderId ?? null,
        saleId: input.saleId ?? null,
        customerId,
        description: description || 'Entrada avulsa',
        amountCents: input.amountCents,
        method: input.method,
        paidDate: input.paidDate,
        notes: input.notes ?? null,
        isDemo: opts.isDemo ?? false,
        createdBy: actor?.id ?? null,
        ...(opts.createdAt ? { createdAt: opts.createdAt, updatedAt: opts.createdAt } : {}),
      })
      .returning();

    if (input.orderId) {
      await tx.insert(serviceOrderEvents).values({
        orderId: input.orderId,
        type: 'PAYMENT',
        message: `Pagamento de ${formatBRL(input.amountCents)} recebido (${PAYMENT_METHOD_LABEL[input.method]}).`,
        userId: actor?.id ?? null,
        ...(opts.createdAt ? { createdAt: opts.createdAt } : {}),
      });
    }
    await audit({
      actor,
      action: 'PAYMENT_CREATE',
      entityType: 'payments',
      entityId: created!.id,
      summary: `Pagamento ${formatBRL(input.amountCents)} (${PAYMENT_METHOD_LABEL[input.method]})`,
    });
    return created!;
  });
}

export async function voidPayment(id: number, reason: string, actor: Actor): Promise<void> {
  await runWrite(async (tx) => {
    const [payment] = await tx.select().from(payments).where(eq(payments.id, id)).limit(1);
    if (!payment) throw new NotFoundError('Pagamento');
    if (payment.status === 'VOIDED') throw new BusinessError('Este pagamento já foi estornado.');
    await tx
      .update(payments)
      .set({ status: 'VOIDED', voidedAt: new Date(), voidReason: reason, voidedBy: actor.id })
      .where(eq(payments.id, id));
    if (payment.orderId) {
      await tx.insert(serviceOrderEvents).values({
        orderId: payment.orderId,
        type: 'PAYMENT',
        message: `Pagamento de ${formatBRL(payment.amountCents)} estornado. Motivo: ${reason}`,
        userId: actor.id,
      });
    }
    await audit({ actor, action: 'PAYMENT_VOID', entityType: 'payments', entityId: id, summary: `Pagamento estornado: ${reason}`, data: { amountCents: payment.amountCents } });
  });
}

export async function getPayment(id: number) {
  const [row] = await getDb().select().from(payments).where(eq(payments.id, id)).limit(1);
  return row ?? null;
}

export interface PaymentRow {
  id: number;
  paidDate: ISODate;
  description: string;
  amountCents: number;
  method: PaymentMethod;
  status: 'PAID' | 'VOIDED';
  notes: string | null;
  voidReason: string | null;
  isDemo: boolean;
  customerId: number | null;
  customerName: string | null;
  orderId: number | null;
  orderNumber: number | null;
  saleId: number | null;
  saleNumber: number | null;
}

export const PAYMENT_SORT_KEYS = ['date', 'amount', 'method'] as const;

export async function listPayments(params: {
  from?: ISODate;
  to?: ISODate;
  method?: PaymentMethod;
  q?: string;
  includeVoided?: boolean;
  orderId?: number;
  sort?: (typeof PAYMENT_SORT_KEYS)[number];
  dir?: 'asc' | 'desc';
  page?: number;
  pageSize?: number;
}): Promise<PageResult<PaymentRow> & { paidTotalCents: number; byMethod: Record<string, number> }> {
  const db = getDb();
  const pageSize = params.pageSize ?? 20;
  const page = Math.max(1, params.page ?? 1);
  const q = normalizeSearch(params.q);

  const where = allOf(
    params.from ? sql`${payments.paidDate} >= ${params.from}` : undefined,
    params.to ? sql`${payments.paidDate} <= ${params.to}` : undefined,
    params.method ? eq(payments.method, params.method) : undefined,
    params.orderId ? eq(payments.orderId, params.orderId) : undefined,
    params.includeVoided ? undefined : eq(payments.status, 'PAID'),
    q
      ? sql`(lower(${payments.description}) LIKE ${`%${q}%`} OR lower(COALESCE(${customers.name}, '')) LIKE ${`%${q}%`} OR ('os-' || printf('%06d', COALESCE(${serviceOrders.number}, 0))) LIKE ${`%${q}%`} OR ('vd-' || printf('%06d', COALESCE(${sales.number}, 0))) LIKE ${`%${q}%`})`
      : undefined,
  );

  const sortColumn = { date: payments.paidDate, amount: payments.amountCents, method: payments.method }[params.sort ?? 'date'];
  const dir = params.dir === 'asc' ? asc : desc;

  const base = db
    .select({
      id: payments.id,
      paidDate: payments.paidDate,
      description: payments.description,
      amountCents: payments.amountCents,
      method: payments.method,
      status: payments.status,
      notes: payments.notes,
      voidReason: payments.voidReason,
      isDemo: payments.isDemo,
      customerId: payments.customerId,
      customerName: customers.name,
      orderId: payments.orderId,
      orderNumber: serviceOrders.number,
      saleId: payments.saleId,
      saleNumber: sales.number,
    })
    .from(payments)
    .leftJoin(customers, eq(customers.id, payments.customerId))
    .leftJoin(serviceOrders, eq(serviceOrders.id, payments.orderId))
    .leftJoin(sales, eq(sales.id, payments.saleId));

  const rows = await base
    .where(where)
    .orderBy(dir(sortColumn), desc(payments.id))
    .limit(pageSize)
    .offset((page - 1) * pageSize);

  const [totals] = await db
    .select({
      total: sql<number>`count(*)`,
      paid: sql<number>`COALESCE(SUM(CASE WHEN ${payments.status} = 'PAID' THEN ${payments.amountCents} ELSE 0 END), 0)`,
    })
    .from(payments)
    .leftJoin(customers, eq(customers.id, payments.customerId))
    .leftJoin(serviceOrders, eq(serviceOrders.id, payments.orderId))
    .leftJoin(sales, eq(sales.id, payments.saleId))
    .where(where);

  const methodRows = await db
    .select({ method: payments.method, total: sql<number>`COALESCE(SUM(${payments.amountCents}), 0)` })
    .from(payments)
    .leftJoin(customers, eq(customers.id, payments.customerId))
    .leftJoin(serviceOrders, eq(serviceOrders.id, payments.orderId))
    .leftJoin(sales, eq(sales.id, payments.saleId))
    .where(allOf(where, eq(payments.status, 'PAID')))
    .groupBy(payments.method);

  return {
    rows: rows as PaymentRow[],
    total: Number(totals?.total ?? 0),
    paidTotalCents: Number(totals?.paid ?? 0),
    byMethod: Object.fromEntries(methodRows.map((r) => [r.method, Number(r.total)])),
  };
}

/** Pagamentos de uma OS, do mais antigo ao mais recente. */
export async function listOrderPayments(orderId: number) {
  return getDb()
    .select()
    .from(payments)
    .where(eq(payments.orderId, orderId))
    .orderBy(asc(payments.paidDate), asc(payments.id));
}

export async function listSalePayments(saleId: number) {
  return getDb().select().from(payments).where(eq(payments.saleId, saleId)).orderBy(asc(payments.paidDate), asc(payments.id));
}

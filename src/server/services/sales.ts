import { and, asc, desc, eq, inArray, or, sql, type SQL } from 'drizzle-orm';
import type { PaymentMethod } from '@/config/payment-methods';
import { formatSaleCode, parseSaleCode } from '@/lib/codes';
import type { ISODate } from '@/lib/dates';
import { lineTotal } from '@/lib/money';
import { computeOrderTotals } from '@/lib/order-totals';
import { BusinessError, NotFoundError } from '../auth/errors';
import type { Actor } from '../auth/types';
import { getDb, isUniqueViolation, runWrite, type Tx } from '../db/client';
import { customers, payments, products, saleItems, sales, stockMovements, storeOrderEvents, storeOrders, users, type Sale } from '../db/schema';
import { audit } from './audit';
import { registerPayment, salePaidSql } from './payments';
import { allOf, likeAllTokens, type PageResult } from './query-utils';
import { saleSearchText } from './search-text';
import { reconcileStockForRef } from './stock';

export interface SaleItemInput {
  productId?: number | null;
  description: string;
  quantity: number;
  unitPriceCents: number;
  /** Linha de taxa (ex.: entrega): entra no total, mas não conta como produto vendido. */
  isFee?: boolean;
}

export interface SaleInput {
  customerId: number | null;
  saleDate: ISODate;
  discountCents: number;
  notes: string | null;
  items: SaleItemInput[];
  /** Pagamento recebido junto com a venda (opcional). */
  payment?: { method: PaymentMethod; amountCents?: number; paidDate?: ISODate } | null;
}

async function nextSaleNumber(tx: Tx): Promise<number> {
  const [row] = await tx.select({ max: sql<number>`COALESCE(MAX(${sales.number}), 0)` }).from(sales);
  return Number(row?.max ?? 0) + 1;
}

async function syncSaleStock(tx: Tx, sale: Pick<Sale, 'id' | 'status' | 'isDemo'>, actor: Actor | null): Promise<void> {
  if (sale.isDemo) return;
  const desired = new Map<number, number>();
  if (sale.status !== 'CANCELED') {
    const items = await tx.select({ productId: saleItems.productId, quantity: saleItems.quantity }).from(saleItems).where(eq(saleItems.saleId, sale.id));
    for (const item of items) if (item.productId) desired.set(item.productId, (desired.get(item.productId) ?? 0) + item.quantity);
  }
  await reconcileStockForRef(tx, {
    refType: 'sale',
    refId: sale.id,
    desired,
    reason: 'SALE',
    actorId: actor?.id ?? null,
    note: sale.status === 'CANCELED' ? 'Venda cancelada — produtos devolvidos ao estoque' : undefined,
  });
}

/** `actor` nulo = venda gerada pelo próprio sistema (pedido feito por um visitante na loja virtual). */
export async function createSale(
  input: SaleInput,
  actor: Actor | null,
  opts: { isDemo?: boolean; createdAt?: Date; channel?: 'BALCAO' | 'LOJA' } = {},
): Promise<Sale> {
  const attempt = () =>
    runWrite(async (tx) => {
      let customerName: string | null = null;
      if (input.customerId) {
        const [customer] = await tx.select({ name: customers.name }).from(customers).where(eq(customers.id, input.customerId)).limit(1);
        if (!customer) throw new BusinessError('Cliente não encontrado.', 'customerId');
        customerName = customer.name;
      }
      const totals = computeOrderTotals(input.items.map((i) => ({ kind: 'PART' as const, quantity: i.quantity, unitPriceCents: i.unitPriceCents })), input.discountCents);
      if (totals.totalCents <= 0 && input.payment) throw new BusinessError('Não há valor a receber nesta venda.');

      const productIds = [...new Set(input.items.map((i) => i.productId).filter((id): id is number => typeof id === 'number'))];
      const known = productIds.length ? await tx.select({ id: products.id, costCents: products.costCents }).from(products).where(inArray(products.id, productIds)) : [];
      const costs = new Map(known.map((p) => [p.id, p.costCents]));
      if (productIds.some((id) => !costs.has(id))) throw new BusinessError('Um dos produtos da venda não existe mais. Atualize a lista de itens.');

      const number = await nextSaleNumber(tx);
      const code = formatSaleCode(number);
      const [sale] = await tx
        .insert(sales)
        .values({
          number,
          customerId: input.customerId,
          saleDate: input.saleDate,
          discountCents: totals.discountCents,
          totalCents: totals.totalCents,
          notes: input.notes,
          searchText: saleSearchText({ code, customerName, notes: input.notes }),
          channel: opts.channel ?? 'BALCAO',
          isDemo: opts.isDemo ?? false,
          createdBy: actor?.id ?? null,
          ...(opts.createdAt ? { createdAt: opts.createdAt, updatedAt: opts.createdAt } : {}),
        })
        .returning();

      await tx.insert(saleItems).values(
        input.items.map((item, index) => ({
          saleId: sale!.id,
          productId: item.productId ?? null,
          description: item.description.trim(),
          quantity: item.quantity,
          unitPriceCents: item.unitPriceCents,
          unitCostCents: item.productId ? (costs.get(item.productId) ?? 0) : 0,
          totalCents: lineTotal(item.quantity, item.unitPriceCents),
          isFee: item.isFee ?? false,
          position: index,
        })),
      );
      await syncSaleStock(tx, sale!, actor);

      if (input.payment && totals.totalCents > 0) {
        await registerPayment(
          {
            saleId: sale!.id,
            amountCents: input.payment.amountCents ?? totals.totalCents,
            method: input.payment.method,
            paidDate: input.payment.paidDate ?? input.saleDate,
            description: `Venda ${code}`,
          },
          actor,
          { isDemo: opts.isDemo, createdAt: opts.createdAt },
        );
      }
      await audit({ actor, action: 'SALE_CREATE', entityType: 'sales', entityId: sale!.id, summary: `${code} registrada` });
      return sale!;
    });

  for (let tries = 0; ; tries++) {
    try {
      return await attempt();
    } catch (error) {
      if (tries < 3 && isUniqueViolation(error) && /sales\.number/i.test(String((error as Error).message))) continue;
      throw error;
    }
  }
}

/** Cancela a venda: devolve os produtos ao estoque e estorna os pagamentos recebidos. */
export async function cancelSale(id: number, reason: string | null, actor: Actor | null): Promise<void> {
  await runWrite(async (tx) => {
    const [sale] = await tx.select().from(sales).where(eq(sales.id, id)).limit(1);
    if (!sale) throw new NotFoundError('Venda');
    if (sale.status === 'CANCELED') throw new BusinessError('Esta venda já foi cancelada.');
    const [updated] = await tx.update(sales).set({ status: 'CANCELED', canceledAt: new Date(), cancelReason: reason }).where(eq(sales.id, id)).returning();
    await tx
      .update(payments)
      .set({ status: 'VOIDED', voidedAt: new Date(), voidReason: `Venda cancelada${reason ? `: ${reason}` : ''}`, voidedBy: actor?.id ?? null })
      .where(and(eq(payments.saleId, id), eq(payments.status, 'PAID')));
    await syncSaleStock(tx, updated!, actor);
    // Venda de um pedido da loja virtual: o pedido também fica cancelado (o cliente vê no acompanhamento).
    const [linked] = await tx.select({ id: storeOrders.id, status: storeOrders.status }).from(storeOrders).where(eq(storeOrders.saleId, id)).limit(1);
    if (linked && linked.status !== 'CANCELED') {
      await tx.update(storeOrders).set({ status: 'CANCELED', canceledAt: new Date(), cancelReason: reason }).where(eq(storeOrders.id, linked.id));
      await tx.insert(storeOrderEvents).values({ orderId: linked.id, type: 'STATUS', toStatus: 'CANCELED', message: 'Pedido cancelado.', isPublic: true, userId: actor?.id ?? null });
    }
    await audit({ actor, action: 'SALE_CANCEL', entityType: 'sales', entityId: id, summary: `${formatSaleCode(sale.number)} cancelada${reason ? `: ${reason}` : ''}` });
  });
}

export const SALE_SORT_KEYS = ['number', 'date', 'total', 'customer'] as const;

export interface SaleListRow {
  id: number;
  number: number;
  saleDate: ISODate;
  status: 'ACTIVE' | 'CANCELED';
  customerId: number | null;
  customerName: string | null;
  totalCents: number;
  paidCents: number;
  itemsCount: number;
  isDemo: boolean;
  channel: 'BALCAO' | 'LOJA';
  /** Pedido da loja virtual que originou a venda (canal LOJA). */
  storeOrderId: number | null;
  storeOrderNumber: number | null;
  /** Nome digitado pelo comprador no checkout (a venda da loja pode não estar ligada a um cliente cadastrado). */
  storeBuyerName: string | null;
}

export async function listSales(params: {
  q?: string;
  from?: ISODate;
  to?: ISODate;
  status?: 'ACTIVE' | 'CANCELED';
  channel?: 'BALCAO' | 'LOJA';
  sort?: (typeof SALE_SORT_KEYS)[number];
  dir?: 'asc' | 'desc';
  page?: number;
  pageSize?: number;
}): Promise<PageResult<SaleListRow> & { soldTotalCents: number }> {
  const db = getDb();
  const pageSize = params.pageSize ?? 20;
  const page = Math.max(1, params.page ?? 1);
  const code = params.q ? parseSaleCode(params.q) : null;
  const text = likeAllTokens(sales.searchText, params.q);
  const search: SQL | undefined = params.q ? (code ? or(eq(sales.number, code), text) : text) : undefined;
  const where = allOf(
    search,
    params.from ? sql`${sales.saleDate} >= ${params.from}` : undefined,
    params.to ? sql`${sales.saleDate} <= ${params.to}` : undefined,
    params.status ? eq(sales.status, params.status) : undefined,
    params.channel ? eq(sales.channel, params.channel) : undefined,
  );
  const dir = params.dir === 'asc' ? asc : desc;
  const sortColumn = { number: sales.number, date: sales.saleDate, total: sales.totalCents, customer: sql`COALESCE(${customers.name}, '') COLLATE NOCASE` }[params.sort ?? 'number'];

  const rows = await db
    .select({
      id: sales.id,
      number: sales.number,
      saleDate: sales.saleDate,
      status: sales.status,
      customerId: sales.customerId,
      customerName: customers.name,
      totalCents: sales.totalCents,
      paidCents: salePaidSql,
      itemsCount: sql<number>`(SELECT COUNT(*) FROM sale_items i WHERE i.sale_id = ${sales.id} AND i.is_fee = 0)`,
      isDemo: sales.isDemo,
      channel: sales.channel,
      storeOrderId: storeOrders.id,
      storeOrderNumber: storeOrders.number,
      storeBuyerName: storeOrders.buyerName,
    })
    .from(sales)
    .leftJoin(customers, eq(customers.id, sales.customerId))
    .leftJoin(storeOrders, eq(storeOrders.saleId, sales.id))
    .where(where)
    .orderBy(dir(sortColumn), desc(sales.id))
    .limit(pageSize)
    .offset((page - 1) * pageSize);

  const [totals] = await db
    .select({ total: sql<number>`count(*)`, sold: sql<number>`COALESCE(SUM(CASE WHEN ${sales.status} = 'ACTIVE' THEN ${sales.totalCents} ELSE 0 END), 0)` })
    .from(sales)
    .leftJoin(customers, eq(customers.id, sales.customerId))
    .where(where);

  return {
    rows: rows.map((r) => ({ ...r, paidCents: Number(r.paidCents), itemsCount: Number(r.itemsCount) })),
    total: Number(totals?.total ?? 0),
    soldTotalCents: Number(totals?.sold ?? 0),
  };
}

export async function getSaleDetail(id: number) {
  const db = getDb();
  const [sale] = await db.select().from(sales).where(eq(sales.id, id)).limit(1);
  if (!sale) return null;
  const customer = sale.customerId ? ((await db.select().from(customers).where(eq(customers.id, sale.customerId)).limit(1))[0] ?? null) : null;
  const items = await db.select().from(saleItems).where(eq(saleItems.saleId, id)).orderBy(asc(saleItems.position), asc(saleItems.id));
  const salePayments = await db.select().from(payments).where(eq(payments.saleId, id)).orderBy(asc(payments.paidDate), asc(payments.id));
  const creator = sale.createdBy ? (await db.select({ name: users.name }).from(users).where(eq(users.id, sale.createdBy)).limit(1))[0] : undefined;
  const [storeOrder] = await db
    .select({
      id: storeOrders.id,
      number: storeOrders.number,
      status: storeOrders.status,
      fulfillment: storeOrders.fulfillment,
      paymentMethod: storeOrders.paymentMethod,
      buyerName: storeOrders.buyerName,
      buyerPhone: storeOrders.buyerPhone,
      buyerEmail: storeOrders.buyerEmail,
      deliveryAddress: storeOrders.deliveryAddress,
      notes: storeOrders.notes,
      createdAt: storeOrders.createdAt,
    })
    .from(storeOrders).where(eq(storeOrders.saleId, id)).limit(1);
  const paidCents = salePayments.filter((p) => p.status === 'PAID').reduce((s, p) => s + p.amountCents, 0);
  return {
    sale,
    customer,
    items,
    payments: salePayments,
    creatorName: creator?.name ?? null,
    storeOrder: storeOrder ?? null,
    paidCents,
    balanceCents: Math.max(0, sale.totalCents - paidCents),
  };
}

export async function getSaleIdByNumber(number: number): Promise<number | null> {
  const [row] = await getDb().select({ id: sales.id }).from(sales).where(eq(sales.number, number)).limit(1);
  return row?.id ?? null;
}

/** Movimentos de estoque de uma venda (auditoria/testes). */
export async function listSaleStockMovements(saleId: number) {
  return getDb().select().from(stockMovements).where(and(eq(stockMovements.refType, 'sale'), eq(stockMovements.refId, saleId)));
}

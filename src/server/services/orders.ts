import { and, asc, desc, eq, inArray, or, sql, type SQL } from 'drizzle-orm';
import {
  IN_PROGRESS_ORDER_STATUSES,
  ORDER_STATUS,
  OPEN_ORDER_STATUSES,
  type OrderStatus,
} from '@/config/order-status';
import type { ItemKind, PaymentMethod } from '@/config/payment-methods';
import { formatOrderCode, parseOrderCode } from '@/lib/codes';
import { addDaysISO, todayISO, type ISODate } from '@/lib/dates';
import { lineTotal } from '@/lib/money';
import { statusChangeDates } from '@/lib/order-flow';
import { computeOrderTotals } from '@/lib/order-totals';
import { BusinessError, NotFoundError } from '../auth/errors';
import type { Actor } from '../auth/types';
import { getDb, isUniqueViolation, runWrite, type DbOrTx, type Tx } from '../db/client';
import {
  companySettings,
  customers,
  guaranteeTerms,
  payments,
  products,
  serviceOrderEvents,
  serviceOrderItems,
  serviceOrders,
  users,
  type GuaranteeTerms,
  type ServiceOrder,
} from '../db/schema';
import { audit } from './audit';
import { createNotification } from './notifications';
import { orderPaidSql } from './payments';
import { allOf, likeAllTokens, type PageResult } from './query-utils';
import { orderSearchText } from './search-text';
import { reconcileStockForRef } from './stock';

export interface OrderItemInput {
  kind: ItemKind;
  serviceId?: number | null;
  productId?: number | null;
  description: string;
  quantity: number;
  unitPriceCents: number;
}

export interface OrderInput {
  customerId: number;
  equipment: string;
  brand: string | null;
  model: string | null;
  problemDescription: string | null;
  diagnosis: string | null;
  serviceDescription: string | null;
  entryDate: ISODate;
  expectedDeliveryDate: ISODate | null;
  deliveredDate?: ISODate | null;
  nextServiceDate: ISODate | null;
  technicianId: number | null;
  paymentMethod: PaymentMethod | null;
  discountCents: number;
  notes: string | null;
  items: OrderItemInput[];
}

export interface CreateOrderOptions {
  status?: OrderStatus;
  /** Marca a OS como de demonstração (não movimenta estoque nem notifica). */
  isDemo?: boolean;
  createdAt?: Date;
}

// ---------------------------------------------------------------------------
// Auxiliares internos
// ---------------------------------------------------------------------------

async function companyToday(db: DbOrTx): Promise<ISODate> {
  const [row] = await db.select({ tz: companySettings.timezone }).from(companySettings).limit(1);
  return todayISO(row?.tz ?? undefined);
}

async function nextOrderNumber(tx: Tx): Promise<number> {
  const [row] = await tx.select({ max: sql<number>`COALESCE(MAX(${serviceOrders.number}), 0)` }).from(serviceOrders);
  return Number(row?.max ?? 0) + 1;
}

async function paidTotal(tx: DbOrTx, orderId: number): Promise<number> {
  const [row] = await tx
    .select({ n: sql<number>`COALESCE(SUM(${payments.amountCents}), 0)` })
    .from(payments)
    .where(and(eq(payments.orderId, orderId), eq(payments.status, 'PAID')));
  return Number(row?.n ?? 0);
}

async function insertItems(tx: Tx, orderId: number, items: OrderItemInput[]): Promise<void> {
  if (items.length === 0) return;
  const productIds = [...new Set(items.map((i) => i.productId).filter((id): id is number => typeof id === 'number'))];
  const known = productIds.length ? await tx.select({ id: products.id, costCents: products.costCents }).from(products).where(inArray(products.id, productIds)) : [];
  const costs = new Map(known.map((p) => [p.id, p.costCents]));
  for (const id of productIds) {
    if (!costs.has(id)) throw new BusinessError('Um dos produtos da OS não existe mais. Atualize a lista de itens.');
  }
  await tx.insert(serviceOrderItems).values(
    items.map((item, index) => ({
      orderId,
      kind: item.kind,
      serviceId: item.kind === 'SERVICE' ? (item.serviceId ?? null) : null,
      productId: item.kind === 'PART' ? (item.productId ?? null) : null,
      description: item.description.trim(),
      quantity: item.quantity,
      unitPriceCents: item.unitPriceCents,
      unitCostCents: item.kind === 'PART' && item.productId ? (costs.get(item.productId) ?? 0) : 0,
      totalCents: lineTotal(item.quantity, item.unitPriceCents),
      position: index,
    })),
  );
}

/** Produtos consumidos pela OS (peças com produto vinculado). Cancelada não consome estoque. */
async function syncOrderStock(tx: Tx, order: Pick<ServiceOrder, 'id' | 'status' | 'isDemo'>, actor: Actor | null): Promise<void> {
  if (order.isDemo) return; // dados de demonstração nunca alteram o estoque real
  const desired = new Map<number, number>();
  if (order.status !== 'CANCELADO') {
    const items = await tx
      .select({ productId: serviceOrderItems.productId, quantity: serviceOrderItems.quantity })
      .from(serviceOrderItems)
      .where(and(eq(serviceOrderItems.orderId, order.id), eq(serviceOrderItems.kind, 'PART')));
    for (const item of items) {
      if (item.productId) desired.set(item.productId, (desired.get(item.productId) ?? 0) + item.quantity);
    }
  }
  await reconcileStockForRef(tx, {
    refType: 'service_order',
    refId: order.id,
    desired,
    reason: 'ORDER',
    actorId: actor?.id ?? null,
    note: order.status === 'CANCELADO' ? 'OS cancelada — peças devolvidas ao estoque' : undefined,
  });
}

async function addEvent(
  tx: Tx,
  event: {
    orderId: number;
    type: (typeof serviceOrderEvents.$inferInsert)['type'];
    fromStatus?: OrderStatus | null;
    toStatus?: OrderStatus | null;
    message?: string | null;
    userId?: number | null;
    createdAt?: Date;
  },
): Promise<void> {
  await tx.insert(serviceOrderEvents).values({
    orderId: event.orderId,
    type: event.type,
    fromStatus: event.fromStatus ?? null,
    toStatus: event.toStatus ?? null,
    message: event.message ?? null,
    userId: event.userId ?? null,
    ...(event.createdAt ? { createdAt: event.createdAt } : {}),
  });
}

// ---------------------------------------------------------------------------
// Criação, edição, status, exclusão
// ---------------------------------------------------------------------------

export async function createOrder(input: OrderInput, actor: Actor, opts: CreateOrderOptions = {}): Promise<ServiceOrder> {
  const attempt = () =>
    runWrite(async (tx) => {
      const [customer] = await tx.select().from(customers).where(eq(customers.id, input.customerId)).limit(1);
      if (!customer) throw new BusinessError('Selecione um cliente.', 'customerId');

      const status: OrderStatus = opts.status ?? 'AGUARDANDO_AVALIACAO';
      const number = await nextOrderNumber(tx);
      const totals = computeOrderTotals(input.items, input.discountCents);
      const today = await companyToday(tx);
      const dates = statusChangeDates(status, { completedDate: null, deliveredDate: null }, input.entryDate <= today ? input.entryDate : today);
      const code = formatOrderCode(number);

      const [terms] = status === 'ENTREGUE' ? await tx.select({ id: guaranteeTerms.id }).from(guaranteeTerms).where(eq(guaranteeTerms.isActive, true)).limit(1) : [];

      const [order] = await tx
        .insert(serviceOrders)
        .values({
          number,
          customerId: customer.id,
          status,
          equipment: input.equipment,
          brand: input.brand,
          model: input.model,
          problemDescription: input.problemDescription,
          diagnosis: input.diagnosis,
          serviceDescription: input.serviceDescription,
          entryDate: input.entryDate,
          expectedDeliveryDate: input.expectedDeliveryDate,
          nextServiceDate: input.nextServiceDate,
          completedDate: dates.completedDate,
          deliveredDate: dates.deliveredDate,
          technicianId: input.technicianId,
          paymentMethod: input.paymentMethod,
          discountCents: totals.discountCents,
          partsTotalCents: totals.partsTotalCents,
          laborTotalCents: totals.laborTotalCents,
          totalCents: totals.totalCents,
          notes: input.notes,
          guaranteeTermsId: terms?.id ?? null,
          searchText: orderSearchText({ code, customerName: customer.name, customerPhone: customer.phone, equipment: input.equipment, brand: input.brand, model: input.model }),
          isDemo: opts.isDemo ?? false,
          createdBy: actor.id,
          ...(opts.createdAt ? { createdAt: opts.createdAt, updatedAt: opts.createdAt } : {}),
        })
        .returning();

      await insertItems(tx, order!.id, input.items);
      await addEvent(tx, { orderId: order!.id, type: 'CREATED', toStatus: status, message: `Ordem ${code} criada.`, userId: actor.id, createdAt: opts.createdAt });
      await syncOrderStock(tx, order!, actor);

      if (!opts.isDemo) {
        await createNotification({
          type: 'ORDER_CREATED',
          title: `Nova OS ${code}`,
          body: `${customer.name} — ${input.equipment}`,
          link: `/sistema/ordens/${order!.id}`,
          permission: 'orders.view',
          actor,
        });
      }
      await audit({ actor, action: 'ORDER_CREATE', entityType: 'service_orders', entityId: order!.id, summary: `${code} criada para ${customer.name}` });
      return order!;
    });

  // Em ambientes com mais de um processo, dois pedidos simultâneos podem gerar o mesmo número: tenta de novo.
  for (let tries = 0; ; tries++) {
    try {
      return await attempt();
    } catch (error) {
      if (tries < 3 && isUniqueViolation(error) && /service_orders\.number/i.test(String((error as Error).message))) continue;
      throw error;
    }
  }
}

export async function updateOrder(id: number, input: OrderInput, actor: Actor): Promise<ServiceOrder> {
  return runWrite(async (tx) => {
    const [order] = await tx.select().from(serviceOrders).where(eq(serviceOrders.id, id)).limit(1);
    if (!order) throw new NotFoundError('Ordem de serviço');
    if (order.status === 'CANCELADO') throw new BusinessError('Esta ordem está cancelada. Reabra-a (altere o status) antes de editar.');

    const [customer] = await tx.select().from(customers).where(eq(customers.id, input.customerId)).limit(1);
    if (!customer) throw new BusinessError('Selecione um cliente.', 'customerId');

    const totals = computeOrderTotals(input.items, input.discountCents);
    const paid = await paidTotal(tx, id);
    if (totals.totalCents < paid) {
      throw new BusinessError(`O novo total é menor que o já recebido (${(paid / 100).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}). Estorne pagamentos ou ajuste os itens.`, 'items');
    }

    const code = formatOrderCode(order.number);
    const [updated] = await tx
      .update(serviceOrders)
      .set({
        customerId: customer.id,
        equipment: input.equipment,
        brand: input.brand,
        model: input.model,
        problemDescription: input.problemDescription,
        diagnosis: input.diagnosis,
        serviceDescription: input.serviceDescription,
        entryDate: input.entryDate,
        expectedDeliveryDate: input.expectedDeliveryDate,
        nextServiceDate: input.nextServiceDate,
        // "Data de entrega" só pode ser ajustada manualmente quando a OS já está Entregue.
        ...(order.status === 'ENTREGUE' && input.deliveredDate ? { deliveredDate: input.deliveredDate } : {}),
        technicianId: input.technicianId,
        paymentMethod: input.paymentMethod,
        discountCents: totals.discountCents,
        partsTotalCents: totals.partsTotalCents,
        laborTotalCents: totals.laborTotalCents,
        totalCents: totals.totalCents,
        notes: input.notes,
        searchText: orderSearchText({ code, customerName: customer.name, customerPhone: customer.phone, equipment: input.equipment, brand: input.brand, model: input.model }),
      })
      .where(eq(serviceOrders.id, id))
      .returning();

    await tx.delete(serviceOrderItems).where(eq(serviceOrderItems.orderId, id));
    await insertItems(tx, id, input.items);
    if (customer.id !== order.customerId) await tx.update(payments).set({ customerId: customer.id }).where(eq(payments.orderId, id));

    await syncOrderStock(tx, updated!, actor);
    await addEvent(tx, { orderId: id, type: 'EDIT', message: 'Ordem de serviço editada.', userId: actor.id });
    await audit({ actor, action: 'ORDER_UPDATE', entityType: 'service_orders', entityId: id, summary: `${code} editada` });
    return updated!;
  });
}

export async function changeOrderStatus(id: number, to: OrderStatus, actor: Actor, opts: { note?: string | null } = {}): Promise<ServiceOrder> {
  return runWrite(async (tx) => {
    const [order] = await tx.select().from(serviceOrders).where(eq(serviceOrders.id, id)).limit(1);
    if (!order) throw new NotFoundError('Ordem de serviço');
    if (order.status === to) throw new BusinessError('A ordem já está com este status.');

    if (to === 'CANCELADO' && (await paidTotal(tx, id)) > 0) {
      throw new BusinessError('Esta ordem possui pagamentos registrados. Estorne os pagamentos antes de cancelar.');
    }

    const today = await companyToday(tx);
    const dates = statusChangeDates(to, { completedDate: order.completedDate, deliveredDate: order.deliveredDate }, today);
    const [activeTerms] =
      to === 'ENTREGUE' && !order.guaranteeTermsId
        ? await tx.select({ id: guaranteeTerms.id }).from(guaranteeTerms).where(eq(guaranteeTerms.isActive, true)).limit(1)
        : [];

    const [updated] = await tx
      .update(serviceOrders)
      .set({
        status: to,
        completedDate: dates.completedDate,
        deliveredDate: dates.deliveredDate,
        canceledAt: to === 'CANCELADO' ? new Date() : null,
        cancelReason: to === 'CANCELADO' ? (opts.note ?? null) : null,
        ...(activeTerms ? { guaranteeTermsId: activeTerms.id } : {}),
      })
      .where(eq(serviceOrders.id, id))
      .returning();

    await addEvent(tx, { orderId: id, type: 'STATUS', fromStatus: order.status, toStatus: to, message: opts.note ?? null, userId: actor.id });
    await syncOrderStock(tx, updated!, actor);

    const code = formatOrderCode(order.number);
    if (!order.isDemo && (to === 'AGUARDANDO_APROVACAO' || to === 'PRONTO')) {
      const [customer] = await tx.select({ name: customers.name }).from(customers).where(eq(customers.id, order.customerId)).limit(1);
      await createNotification({
        type: to === 'PRONTO' ? 'ORDER_READY' : 'ORDER_AWAITING_APPROVAL',
        title: to === 'PRONTO' ? `Serviço pronto: ${code}` : `${code} aguardando aprovação`,
        body: `${customer?.name ?? ''} — ${order.equipment}`,
        link: `/sistema/ordens/${id}`,
        permission: 'orders.view',
        actor,
      });
    }
    await audit({
      actor,
      action: 'ORDER_STATUS',
      entityType: 'service_orders',
      entityId: id,
      summary: `${code}: ${ORDER_STATUS[order.status].label} → ${ORDER_STATUS[to].label}`,
    });
    return updated!;
  });
}

export async function addOrderNote(id: number, message: string, actor: Actor): Promise<void> {
  await runWrite(async (tx) => {
    const [order] = await tx.select({ id: serviceOrders.id }).from(serviceOrders).where(eq(serviceOrders.id, id)).limit(1);
    if (!order) throw new NotFoundError('Ordem de serviço');
    await addEvent(tx, { orderId: id, type: 'NOTE', message, userId: actor.id });
  });
}

/** Registra que um documento foi gerado/enviado (histórico da OS). */
export async function recordOrderDocumentEvent(id: number, message: string, actor: Actor): Promise<void> {
  await runWrite(async (tx) => {
    await addEvent(tx, { orderId: id, type: 'DOCUMENT', message, userId: actor.id });
  });
}

/** Exclusão definitiva (somente ordens sem pagamentos). O estoque das peças é devolvido. */
export async function deleteOrder(id: number, actor: Actor): Promise<void> {
  await runWrite(async (tx) => {
    const [order] = await tx.select().from(serviceOrders).where(eq(serviceOrders.id, id)).limit(1);
    if (!order) throw new NotFoundError('Ordem de serviço');
    const [count] = await tx.select({ n: sql<number>`count(*)` }).from(payments).where(eq(payments.orderId, id));
    if (Number(count?.n) > 0) {
      throw new BusinessError('Esta ordem possui pagamentos registrados e não pode ser excluída. Cancele a ordem para preservar o histórico financeiro.');
    }
    await syncOrderStock(tx, { id, status: 'CANCELADO', isDemo: order.isDemo }, actor);
    await tx.delete(serviceOrders).where(eq(serviceOrders.id, id));
    await audit({ actor, action: 'ORDER_DELETE', entityType: 'service_orders', entityId: id, summary: `${formatOrderCode(order.number)} excluída` });
  });
}

// ---------------------------------------------------------------------------
// Consultas
// ---------------------------------------------------------------------------

export const ORDER_SORT_KEYS = ['number', 'entry', 'expected', 'total', 'customer', 'status'] as const;
export type OrderSortKey = (typeof ORDER_SORT_KEYS)[number];

export interface OrderListParams {
  q?: string;
  /** 'abertas' | 'encerradas' | uma chave de status */
  status?: string;
  technicianId?: number;
  from?: ISODate;
  to?: ISODate;
  payment?: 'pendente' | 'parcial' | 'pago';
  deadline?: 'atrasadas' | 'proximas' | 'retorno';
  today: ISODate;
  sort?: OrderSortKey;
  dir?: 'asc' | 'desc';
  page?: number;
  pageSize?: number;
  customerId?: number;
}

export interface OrderListRow {
  id: number;
  number: number;
  status: OrderStatus;
  customerId: number;
  customerName: string;
  customerPhone: string | null;
  equipment: string;
  brand: string | null;
  model: string | null;
  entryDate: ISODate;
  expectedDeliveryDate: ISODate | null;
  totalCents: number;
  paidCents: number;
  technicianName: string | null;
  isDemo: boolean;
}

function orderFilters(params: OrderListParams): SQL | undefined {
  const inProgress = IN_PROGRESS_ORDER_STATUSES as OrderStatus[];
  const code = params.q ? parseOrderCode(params.q) : null;
  const text = likeAllTokens(serviceOrders.searchText, params.q);
  const search = params.q ? (code ? or(eq(serviceOrders.number, code), text) : text) : undefined;

  let status: SQL | undefined;
  if (params.status === 'abertas') status = inArray(serviceOrders.status, OPEN_ORDER_STATUSES);
  else if (params.status === 'encerradas') status = inArray(serviceOrders.status, ['ENTREGUE', 'CANCELADO']);
  else if (params.status && params.status in ORDER_STATUS) status = eq(serviceOrders.status, params.status as OrderStatus);

  let payment: SQL | undefined;
  if (params.payment === 'pendente') payment = sql`(${serviceOrders.totalCents} > 0 AND ${orderPaidSql} = 0)`;
  else if (params.payment === 'parcial') payment = sql`(${orderPaidSql} > 0 AND ${orderPaidSql} < ${serviceOrders.totalCents})`;
  else if (params.payment === 'pago') payment = sql`(${serviceOrders.totalCents} > 0 AND ${orderPaidSql} >= ${serviceOrders.totalCents})`;

  let deadline: SQL | undefined;
  if (params.deadline === 'atrasadas') {
    deadline = and(inArray(serviceOrders.status, inProgress), sql`${serviceOrders.expectedDeliveryDate} < ${params.today}`);
  } else if (params.deadline === 'proximas') {
    deadline = and(
      inArray(serviceOrders.status, inProgress),
      sql`${serviceOrders.expectedDeliveryDate} >= ${params.today}`,
      sql`${serviceOrders.expectedDeliveryDate} <= ${addDaysISO(params.today, 2)}`,
    );
  } else if (params.deadline === 'retorno') {
    deadline = and(sql`${serviceOrders.nextServiceDate} >= ${params.today}`, sql`${serviceOrders.nextServiceDate} <= ${addDaysISO(params.today, 7)}`, sql`${serviceOrders.status} <> 'CANCELADO'`);
  }

  return allOf(
    search,
    status,
    payment,
    deadline,
    params.technicianId ? eq(serviceOrders.technicianId, params.technicianId) : undefined,
    params.customerId ? eq(serviceOrders.customerId, params.customerId) : undefined,
    params.from ? sql`${serviceOrders.entryDate} >= ${params.from}` : undefined,
    params.to ? sql`${serviceOrders.entryDate} <= ${params.to}` : undefined,
  );
}

export async function listOrders(params: OrderListParams): Promise<PageResult<OrderListRow>> {
  const db = getDb();
  const pageSize = params.pageSize ?? 20;
  const page = Math.max(1, params.page ?? 1);
  const where = orderFilters(params);
  const dir = params.dir === 'asc' ? asc : desc;
  const sortColumn = {
    number: serviceOrders.number,
    entry: serviceOrders.entryDate,
    expected: sql`COALESCE(${serviceOrders.expectedDeliveryDate}, '9999-12-31')`,
    total: serviceOrders.totalCents,
    customer: sql`${customers.name} COLLATE NOCASE`,
    status: serviceOrders.status,
  }[params.sort ?? 'number'];

  const rows = await db
    .select({
      id: serviceOrders.id,
      number: serviceOrders.number,
      status: serviceOrders.status,
      customerId: serviceOrders.customerId,
      customerName: customers.name,
      customerPhone: customers.phone,
      equipment: serviceOrders.equipment,
      brand: serviceOrders.brand,
      model: serviceOrders.model,
      entryDate: serviceOrders.entryDate,
      expectedDeliveryDate: serviceOrders.expectedDeliveryDate,
      totalCents: serviceOrders.totalCents,
      paidCents: orderPaidSql,
      technicianName: users.name,
      isDemo: serviceOrders.isDemo,
    })
    .from(serviceOrders)
    .innerJoin(customers, eq(customers.id, serviceOrders.customerId))
    .leftJoin(users, eq(users.id, serviceOrders.technicianId))
    .where(where)
    .orderBy(dir(sortColumn), desc(serviceOrders.id))
    .limit(pageSize)
    .offset((page - 1) * pageSize);

  const [{ total }] = await db
    .select({ total: sql<number>`count(*)` })
    .from(serviceOrders)
    .innerJoin(customers, eq(customers.id, serviceOrders.customerId))
    .where(where);

  return { rows: rows.map((r) => ({ ...r, paidCents: Number(r.paidCents) })), total: Number(total) };
}

export async function getOrderIdByNumber(number: number): Promise<number | null> {
  const [row] = await getDb().select({ id: serviceOrders.id }).from(serviceOrders).where(eq(serviceOrders.number, number)).limit(1);
  return row?.id ?? null;
}

export async function getOrder(id: number, db: DbOrTx = getDb()): Promise<ServiceOrder | null> {
  const [row] = await db.select().from(serviceOrders).where(eq(serviceOrders.id, id)).limit(1);
  return row ?? null;
}

export interface OrderDetail {
  order: ServiceOrder;
  customer: typeof customers.$inferSelect;
  technician: { id: number; name: string } | null;
  creatorName: string | null;
  items: (typeof serviceOrderItems.$inferSelect)[];
  events: { id: number; type: (typeof serviceOrderEvents.$inferSelect)['type']; fromStatus: OrderStatus | null; toStatus: OrderStatus | null; message: string | null; createdAt: Date; userName: string | null }[];
  payments: (typeof payments.$inferSelect)[];
  paidCents: number;
  balanceCents: number;
  terms: GuaranteeTerms | null;
}

export async function getOrderDetail(id: number): Promise<OrderDetail | null> {
  const db = getDb();
  const order = await getOrder(id);
  if (!order) return null;

  const [customer] = await db.select().from(customers).where(eq(customers.id, order.customerId)).limit(1);
  const technician = order.technicianId
    ? ((await db.select({ id: users.id, name: users.name }).from(users).where(eq(users.id, order.technicianId)).limit(1))[0] ?? null)
    : null;
  const creator = order.createdBy ? (await db.select({ name: users.name }).from(users).where(eq(users.id, order.createdBy)).limit(1))[0] : undefined;
  const items = await db.select().from(serviceOrderItems).where(eq(serviceOrderItems.orderId, id)).orderBy(asc(serviceOrderItems.position), asc(serviceOrderItems.id));
  const events = await db
    .select({
      id: serviceOrderEvents.id,
      type: serviceOrderEvents.type,
      fromStatus: serviceOrderEvents.fromStatus,
      toStatus: serviceOrderEvents.toStatus,
      message: serviceOrderEvents.message,
      createdAt: serviceOrderEvents.createdAt,
      userName: users.name,
    })
    .from(serviceOrderEvents)
    .leftJoin(users, eq(users.id, serviceOrderEvents.userId))
    .where(eq(serviceOrderEvents.orderId, id))
    .orderBy(desc(serviceOrderEvents.createdAt), desc(serviceOrderEvents.id));
  const orderPayments = await db.select().from(payments).where(eq(payments.orderId, id)).orderBy(asc(payments.paidDate), asc(payments.id));
  const paidCents = orderPayments.filter((p) => p.status === 'PAID').reduce((sum, p) => sum + p.amountCents, 0);
  const terms = order.guaranteeTermsId
    ? ((await db.select().from(guaranteeTerms).where(eq(guaranteeTerms.id, order.guaranteeTermsId)).limit(1))[0] ?? null)
    : null;

  return {
    order,
    customer: customer!,
    technician,
    creatorName: creator?.name ?? null,
    items,
    events,
    payments: orderPayments,
    paidCents,
    balanceCents: Math.max(0, order.totalCents - paidCents),
    terms,
  };
}

/** Itens da OS com o estoque atual do produto vinculado (formulário de edição). */
export async function listOrderItemsForEdit(orderId: number) {
  const rows = await getDb()
    .select({
      kind: serviceOrderItems.kind,
      serviceId: serviceOrderItems.serviceId,
      productId: serviceOrderItems.productId,
      description: serviceOrderItems.description,
      quantity: serviceOrderItems.quantity,
      unitPriceCents: serviceOrderItems.unitPriceCents,
      stock: products.stock,
      unit: products.unit,
    })
    .from(serviceOrderItems)
    .leftJoin(products, eq(products.id, serviceOrderItems.productId))
    .where(eq(serviceOrderItems.orderId, orderId))
    .orderBy(asc(serviceOrderItems.position), asc(serviceOrderItems.id));
  return rows.map((row) => ({ ...row, linkedName: row.serviceId || row.productId ? row.description : null }));
}

/** Ordens em andamento (para o dashboard). */
export async function listInProgressOrders(limit = 8) {
  return getDb()
    .select({
      id: serviceOrders.id,
      number: serviceOrders.number,
      status: serviceOrders.status,
      customerName: customers.name,
      equipment: serviceOrders.equipment,
      expectedDeliveryDate: serviceOrders.expectedDeliveryDate,
      totalCents: serviceOrders.totalCents,
      isDemo: serviceOrders.isDemo,
    })
    .from(serviceOrders)
    .innerJoin(customers, eq(customers.id, serviceOrders.customerId))
    .where(inArray(serviceOrders.status, IN_PROGRESS_ORDER_STATUSES))
    .orderBy(sql`COALESCE(${serviceOrders.expectedDeliveryDate}, '9999-12-31')`, asc(serviceOrders.entryDate))
    .limit(limit);
}

export async function listRecentOrders(limit = 8) {
  return getDb()
    .select({
      id: serviceOrders.id,
      number: serviceOrders.number,
      status: serviceOrders.status,
      customerName: customers.name,
      equipment: serviceOrders.equipment,
      entryDate: serviceOrders.entryDate,
      totalCents: serviceOrders.totalCents,
      isDemo: serviceOrders.isDemo,
    })
    .from(serviceOrders)
    .innerJoin(customers, eq(customers.id, serviceOrders.customerId))
    .orderBy(desc(serviceOrders.createdAt), desc(serviceOrders.id))
    .limit(limit);
}

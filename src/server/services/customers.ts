import { and, asc, desc, eq, getTableColumns, ne, sql } from 'drizzle-orm';
import { COMPLETED_ORDER_STATUSES } from '@/config/order-status';
import { formatOrderCode } from '@/lib/codes';
import { formatPhoneBR } from '@/lib/phone';
import { onlyDigits } from '@/lib/text';
import { NotFoundError, BusinessError } from '../auth/errors';
import type { Actor } from '../auth/types';
import { getDb, runWrite, type DbOrTx } from '../db/client';
import { customers, payments, sales, serviceOrders, users, type Customer } from '../db/schema';
import { audit } from './audit';
import { allOf, likeAllTokens, type PageResult } from './query-utils';
import { customerSearchText, orderSearchText } from './search-text';

export interface CustomerData {
  name: string;
  phone: string | null;
  whatsapp: string | null;
  document: string | null;
  email: string | null;
  address: string | null;
  notes: string | null;
}

function normalizeContacts<T extends { phone: string | null; whatsapp: string | null }>(data: T): T {
  return {
    ...data,
    phone: data.phone ? formatPhoneBR(data.phone) : null,
    whatsapp: data.whatsapp ? formatPhoneBR(data.whatsapp) : null,
  };
}

// ---------------------------------------------------------------------------
// Consultas
// ---------------------------------------------------------------------------

/** Descrição do serviço de uma OS: texto do serviço realizado → 1º item de serviço → equipamento. */
const orderDescriptionSql = sql<string>`COALESCE(NULLIF(${serviceOrders.serviceDescription}, ''), (SELECT i.description FROM service_order_items i WHERE i.order_id = ${serviceOrders.id} AND i.kind = 'SERVICE' ORDER BY i.position, i.id LIMIT 1), ${serviceOrders.equipment})`;

const COMPLETED_LIST = COMPLETED_ORDER_STATUSES.map((s) => `'${s}'`).join(',');
const lastServiceDateSql = sql<string | null>`(SELECT COALESCE(o.completed_date, o.entry_date) FROM service_orders o WHERE o.customer_id = ${customers.id} AND o.status IN (${sql.raw(COMPLETED_LIST)}) ORDER BY COALESCE(o.completed_date, o.entry_date) DESC, o.id DESC LIMIT 1)`;
const lastServiceDescriptionSql = sql<string | null>`(SELECT COALESCE(NULLIF(o.service_description, ''), (SELECT i.description FROM service_order_items i WHERE i.order_id = o.id AND i.kind = 'SERVICE' ORDER BY i.position, i.id LIMIT 1), o.equipment) FROM service_orders o WHERE o.customer_id = ${customers.id} AND o.status IN (${sql.raw(COMPLETED_LIST)}) ORDER BY COALESCE(o.completed_date, o.entry_date) DESC, o.id DESC LIMIT 1)`;
const lastServiceCentsSql = sql<number | null>`(SELECT o.total_cents FROM service_orders o WHERE o.customer_id = ${customers.id} AND o.status IN (${sql.raw(COMPLETED_LIST)}) ORDER BY COALESCE(o.completed_date, o.entry_date) DESC, o.id DESC LIMIT 1)`;
const ordersCountSql = sql<number>`(SELECT COUNT(*) FROM service_orders o WHERE o.customer_id = ${customers.id} AND o.status <> 'CANCELADO')`;
const openOrdersSql = sql<number>`(SELECT COUNT(*) FROM service_orders o WHERE o.customer_id = ${customers.id} AND o.status NOT IN ('ENTREGUE', 'CANCELADO'))`;

export type CustomerSortKey = 'name' | 'created' | 'lastService' | 'orders';
export const CUSTOMER_SORT_KEYS: readonly CustomerSortKey[] = ['name', 'created', 'lastService', 'orders'];

export interface CustomerRow extends Customer {
  ordersCount: number;
  openOrders: number;
  lastServiceDate: string | null;
  lastServiceDescription: string | null;
  lastServiceCents: number | null;
}

export async function listCustomers(params: {
  q?: string;
  sort?: CustomerSortKey;
  dir?: 'asc' | 'desc';
  page?: number;
  pageSize?: number;
}): Promise<PageResult<CustomerRow>> {
  const db = getDb();
  const pageSize = params.pageSize ?? 20;
  const page = Math.max(1, params.page ?? 1);
  const where = allOf(likeAllTokens(customers.searchText, params.q));
  const dir = params.dir === 'asc' ? asc : desc;

  const sortColumn = {
    name: sql`${customers.name} COLLATE NOCASE`,
    created: customers.createdAt,
    lastService: lastServiceDateSql,
    orders: ordersCountSql,
  }[params.sort ?? 'name'];

  const rows = await db
    .select({
      ...getTableColumns(customers),
      ordersCount: ordersCountSql,
      openOrders: openOrdersSql,
      lastServiceDate: lastServiceDateSql,
      lastServiceDescription: lastServiceDescriptionSql,
      lastServiceCents: lastServiceCentsSql,
    })
    .from(customers)
    .where(where)
    .orderBy(dir(sortColumn), asc(customers.id))
    .limit(pageSize)
    .offset((page - 1) * pageSize);

  const [{ total }] = await db.select({ total: sql<number>`count(*)` }).from(customers).where(where);
  return { rows: rows.map((r) => ({ ...r, ordersCount: Number(r.ordersCount), openOrders: Number(r.openOrders) })), total: Number(total) };
}

export async function getCustomer(id: number, db: DbOrTx = getDb()): Promise<Customer | null> {
  const [row] = await db.select().from(customers).where(eq(customers.id, id)).limit(1);
  return row ?? null;
}

/** Lista compacta para seletores (busca por nome/telefone). */
export async function searchCustomersForSelect(q: string, limit = 8) {
  return getDb()
    .select({ id: customers.id, name: customers.name, phone: customers.phone, whatsapp: customers.whatsapp, address: customers.address, isDemo: customers.isDemo })
    .from(customers)
    .where(likeAllTokens(customers.searchText, q))
    .orderBy(asc(sql`${customers.name} COLLATE NOCASE`))
    .limit(limit);
}

export interface CustomerTimelineItem {
  orderId: number;
  number: number;
  status: (typeof serviceOrders.$inferSelect)['status'];
  entryDate: string;
  completedDate: string | null;
  equipment: string;
  brand: string | null;
  model: string | null;
  description: string;
  totalCents: number;
  technicianName: string | null;
}

export interface CustomerDetail {
  customer: Customer;
  stats: {
    orders: number;
    openOrders: number;
    paidCents: number;
    salesCount: number;
  };
  lastService: { date: string; description: string; cents: number; orderId: number; number: number } | null;
  timeline: CustomerTimelineItem[];
}

export async function getCustomerDetail(id: number): Promise<CustomerDetail | null> {
  const db = getDb();
  const customer = await getCustomer(id);
  if (!customer) return null;

  const timelineRows = await db
    .select({
      orderId: serviceOrders.id,
      number: serviceOrders.number,
      status: serviceOrders.status,
      entryDate: serviceOrders.entryDate,
      completedDate: serviceOrders.completedDate,
      equipment: serviceOrders.equipment,
      brand: serviceOrders.brand,
      model: serviceOrders.model,
      description: orderDescriptionSql,
      totalCents: serviceOrders.totalCents,
      technicianName: users.name,
    })
    .from(serviceOrders)
    .leftJoin(users, eq(users.id, serviceOrders.technicianId))
    .where(eq(serviceOrders.customerId, id))
    .orderBy(desc(serviceOrders.entryDate), desc(serviceOrders.id));

  const [paid] = await db
    .select({ total: sql<number>`COALESCE(SUM(${payments.amountCents}), 0)` })
    .from(payments)
    .where(and(eq(payments.customerId, id), eq(payments.status, 'PAID')));
  const [salesRow] = await db
    .select({ n: sql<number>`count(*)` })
    .from(sales)
    .where(and(eq(sales.customerId, id), ne(sales.status, 'CANCELED')));

  const active = timelineRows.filter((o) => o.status !== 'CANCELADO');
  const done = timelineRows
    .filter((o) => (COMPLETED_ORDER_STATUSES as string[]).includes(o.status))
    .sort((a, b) => (b.completedDate ?? b.entryDate).localeCompare(a.completedDate ?? a.entryDate) || b.orderId - a.orderId)[0];

  return {
    customer,
    stats: {
      orders: active.length,
      openOrders: active.filter((o) => o.status !== 'ENTREGUE').length,
      paidCents: Number(paid?.total ?? 0),
      salesCount: Number(salesRow?.n ?? 0),
    },
    lastService: done
      ? { date: done.completedDate ?? done.entryDate, description: done.description, cents: done.totalCents, orderId: done.orderId, number: done.number }
      : null,
    timeline: timelineRows,
  };
}

/** Clientes já cadastrados com o mesmo telefone/WhatsApp (para avisar sobre duplicidade). */
export async function findCustomersByPhone(phones: (string | null)[], excludeId?: number) {
  const digits = phones.map((p) => onlyDigits(p)).filter((d) => d.length >= 8);
  if (digits.length === 0) return [];
  const candidates = await getDb()
    .select({ id: customers.id, name: customers.name, phone: customers.phone, whatsapp: customers.whatsapp })
    .from(customers)
    .where(excludeId ? ne(customers.id, excludeId) : undefined);
  return candidates.filter((c) => {
    const own = [onlyDigits(c.phone), onlyDigits(c.whatsapp)].filter(Boolean);
    return own.some((d) => digits.includes(d));
  });
}

// ---------------------------------------------------------------------------
// Gravações
// ---------------------------------------------------------------------------

export async function createCustomer(input: CustomerData, actor: Actor, opts: { isDemo?: boolean; createdAt?: Date } = {}): Promise<Customer> {
  const data = normalizeContacts(input);
  return runWrite(async (tx) => {
    const [created] = await tx
      .insert(customers)
      .values({
        ...data,
        searchText: customerSearchText(data),
        isDemo: opts.isDemo ?? false,
        createdBy: actor.id,
        ...(opts.createdAt ? { createdAt: opts.createdAt, updatedAt: opts.createdAt } : {}),
      })
      .returning();
    await audit({ actor, action: 'CUSTOMER_CREATE', entityType: 'customers', entityId: created!.id, summary: `Cliente cadastrado: ${created!.name}` });
    return created!;
  });
}

export async function updateCustomer(id: number, input: CustomerData, actor: Actor): Promise<Customer> {
  const data = normalizeContacts(input);
  return runWrite(async (tx) => {
    const existing = await getCustomer(id, tx);
    if (!existing) throw new NotFoundError('Cliente');
    const [updated] = await tx
      .update(customers)
      .set({ ...data, searchText: customerSearchText(data) })
      .where(eq(customers.id, id))
      .returning();
    // Mantém a busca das OS coerente com o novo nome/telefone do cliente.
    if (existing.name !== data.name || existing.phone !== data.phone) {
      const orders = await tx
        .select({ id: serviceOrders.id, number: serviceOrders.number, equipment: serviceOrders.equipment, brand: serviceOrders.brand, model: serviceOrders.model })
        .from(serviceOrders)
        .where(eq(serviceOrders.customerId, id));
      for (const order of orders) {
        const searchText = orderSearchText({
          code: formatOrderCode(order.number),
          customerName: data.name,
          customerPhone: data.phone,
          equipment: order.equipment,
          brand: order.brand,
          model: order.model,
        });
        await tx.update(serviceOrders).set({ searchText }).where(eq(serviceOrders.id, order.id));
      }
    }
    await audit({ actor, action: 'CUSTOMER_UPDATE', entityType: 'customers', entityId: id, summary: `Cliente atualizado: ${data.name}` });
    return updated!;
  });
}

/** Só clientes sem nenhum histórico (ordens, vendas ou pagamentos) podem ser excluídos. */
export async function deleteCustomer(id: number, actor: Actor): Promise<void> {
  await runWrite(async (tx) => {
    const existing = await getCustomer(id, tx);
    if (!existing) throw new NotFoundError('Cliente');
    const [o] = await tx.select({ n: sql<number>`count(*)` }).from(serviceOrders).where(eq(serviceOrders.customerId, id));
    const [s] = await tx.select({ n: sql<number>`count(*)` }).from(sales).where(eq(sales.customerId, id));
    const [p] = await tx.select({ n: sql<number>`count(*)` }).from(payments).where(eq(payments.customerId, id));
    if (Number(o?.n) + Number(s?.n) + Number(p?.n) > 0) {
      throw new BusinessError('Este cliente possui histórico (ordens, vendas ou pagamentos) e não pode ser excluído. Para preservar os registros, mantenha o cadastro.');
    }
    await tx.delete(customers).where(eq(customers.id, id));
    await audit({ actor, action: 'CUSTOMER_DELETE', entityType: 'customers', entityId: id, summary: `Cliente excluído: ${existing.name}` });
  });
}

export async function countCustomers(): Promise<number> {
  const [row] = await getDb().select({ n: sql<number>`count(*)` }).from(customers);
  return Number(row?.n ?? 0);
}

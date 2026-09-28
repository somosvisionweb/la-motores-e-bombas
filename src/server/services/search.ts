/** Busca global: clientes, telefone, OS, produtos, serviços e vendas — respeitando as permissões do usuário. */
import { asc, eq, sql } from 'drizzle-orm';
import { formatOrderCode, formatSaleCode, formatStoreOrderCode, parseOrderCode, parseSaleCode, parseStoreOrderCode } from '@/lib/codes';
import { displayPhone } from '@/lib/phone';
import { joinParts, onlyDigits } from '@/lib/text';
import type { SessionUser } from '../auth/types';
import { hasPermission } from '../auth/types';
import { getDb } from '../db/client';
import { customers, products, sales, serviceOrders, services, storeOrders } from '../db/schema';
import { likeAllTokens } from './query-utils';

export interface SearchResult {
  type: 'customer' | 'order' | 'product' | 'service' | 'sale' | 'store';
  id: number;
  title: string;
  subtitle: string;
  href: string;
}

export interface SearchGroup {
  label: string;
  items: SearchResult[];
}

export interface SearchResponse {
  groups: SearchGroup[];
  /** Quando a busca é um código exato (OS-000123 / VD-000045), abre direto. */
  direct: SearchResult | null;
}

const PER_GROUP = 5;

export async function globalSearch(query: string, user: Pick<SessionUser, 'permissions'>): Promise<SearchResponse> {
  const q = query.trim().slice(0, 80);
  if (q.length < 2) return { groups: [], direct: null };
  const db = getDb();
  const groups: SearchGroup[] = [];
  let direct: SearchResult | null = null;

  const explicitOrder = /^\s*(os|#)/i.test(q) ? parseOrderCode(q) : null;
  const digitsOnly = /^\d{1,6}$/.test(q) ? Number(q) : null;
  const orderNumber = explicitOrder ?? digitsOnly;
  const saleNumber = parseSaleCode(q);
  const storeNumber = parseStoreOrderCode(q);

  if (hasPermission(user, 'orders.view')) {
    const rows = await db
      .select({ id: serviceOrders.id, number: serviceOrders.number, equipment: serviceOrders.equipment, customer: customers.name })
      .from(serviceOrders)
      .innerJoin(customers, eq(customers.id, serviceOrders.customerId))
      .where(orderNumber ? sql`(${serviceOrders.number} = ${orderNumber} OR ${likeAllTokens(serviceOrders.searchText, q) ?? sql`0`})` : likeAllTokens(serviceOrders.searchText, q))
      .orderBy(sql`CASE WHEN ${serviceOrders.number} = ${orderNumber ?? -1} THEN 0 ELSE 1 END`, sql`${serviceOrders.number} DESC`)
      .limit(PER_GROUP);
    const items = rows.map<SearchResult>((r) => ({ type: 'order', id: r.id, title: `${formatOrderCode(r.number)} · ${r.customer}`, subtitle: r.equipment, href: `/sistema/ordens/${r.id}` }));
    if (items.length) groups.push({ label: 'Ordens de serviço', items });
    if (explicitOrder && rows[0] && rows[0].number === explicitOrder) direct = items[0]!;
  }

  if (hasPermission(user, 'customers.view')) {
    const rows = await db
      .select({ id: customers.id, name: customers.name, phone: customers.phone, address: customers.address })
      .from(customers)
      .where(likeAllTokens(customers.searchText, q))
      .orderBy(asc(sql`${customers.name} COLLATE NOCASE`))
      .limit(PER_GROUP);
    const items = rows.map<SearchResult>((r) => ({
      type: 'customer',
      id: r.id,
      title: r.name,
      subtitle: joinParts([displayPhone(r.phone), r.address], ' · ') || 'Sem contato',
      href: `/sistema/clientes/${r.id}`,
    }));
    if (items.length) groups.unshift({ label: 'Clientes', items });
  }

  if (hasPermission(user, 'products.view')) {
    const rows = await db
      .select({ id: products.id, name: products.name, code: products.code, stock: products.stock, unit: products.unit })
      .from(products)
      .where(likeAllTokens(products.searchText, q))
      .orderBy(asc(sql`${products.name} COLLATE NOCASE`))
      .limit(PER_GROUP);
    const items = rows.map<SearchResult>((r) => ({ type: 'product', id: r.id, title: r.name, subtitle: `${r.code ?? ''} · estoque ${r.stock} ${r.unit}`, href: `/sistema/produtos/${r.id}` }));
    if (items.length) groups.push({ label: 'Produtos', items });
  }

  if (hasPermission(user, 'services.view')) {
    const rows = await db
      .select({ id: services.id, name: services.name, category: services.category })
      .from(services)
      .where(likeAllTokens(services.searchText, q))
      .orderBy(asc(services.sortOrder))
      .limit(PER_GROUP);
    const canEdit = hasPermission(user, 'services.manage');
    const items = rows.map<SearchResult>((r) => ({ type: 'service', id: r.id, title: r.name, subtitle: r.category, href: canEdit ? `/sistema/servicos/${r.id}/editar` : '/sistema/servicos' }));
    if (items.length) groups.push({ label: 'Serviços', items });
  }

  if (hasPermission(user, 'sales.view') && (saleNumber || /^vd|venda/i.test(q))) {
    const rows = await db
      .select({ id: sales.id, number: sales.number, customer: customers.name })
      .from(sales)
      .leftJoin(customers, eq(customers.id, sales.customerId))
      .where(saleNumber ? eq(sales.number, saleNumber) : likeAllTokens(sales.searchText, q))
      .orderBy(sql`${sales.number} DESC`)
      .limit(PER_GROUP);
    const items = rows.map<SearchResult>((r) => ({ type: 'sale', id: r.id, title: `${formatSaleCode(r.number)} · ${r.customer ?? 'Consumidor final'}`, subtitle: 'Venda', href: `/sistema/vendas/${r.id}` }));
    if (items.length) groups.push({ label: 'Vendas', items });
    if (saleNumber && rows[0] && rows[0].number === saleNumber) direct = items[0]!;
  }

  if (hasPermission(user, 'store.view') && (storeNumber || /^(lj|loja|pedido)/i.test(q))) {
    const rows = await db
      .select({ id: storeOrders.id, number: storeOrders.number, buyer: storeOrders.buyerName })
      .from(storeOrders)
      .where(storeNumber ? eq(storeOrders.number, storeNumber) : likeAllTokens(storeOrders.searchText, q))
      .orderBy(sql`${storeOrders.number} DESC`)
      .limit(PER_GROUP);
    const items = rows.map<SearchResult>((r) => ({ type: 'store', id: r.id, title: `${formatStoreOrderCode(r.number)} · ${r.buyer}`, subtitle: 'Pedido da loja online', href: `/sistema/loja/${r.id}` }));
    if (items.length) groups.push({ label: 'Loja online', items });
    if (storeNumber && rows[0] && rows[0].number === storeNumber) direct = items[0]!;
  }

  // Busca por dígitos de telefone não deve abrir OS por engano: só código explícito abre direto.
  if (!explicitOrder && !saleNumber && !storeNumber && onlyDigits(q).length >= 8) direct = null;
  return { groups, direct };
}

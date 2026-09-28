/**
 * Loja virtual — pedidos.
 *
 * Cada pedido tem uma VENDA (`sales`, canal LOJA) criada na mesma transação: é ela que baixa o estoque,
 * guarda o custo do momento e recebe os pagamentos (aparecem no Financeiro e nos relatórios como qualquer venda).
 * O pedido (`store_orders`) guarda o que é próprio da loja: comprador, entrega, status, link público e PIX.
 *
 * Estoque: reservado na criação do pedido (a venda baixa o estoque) e devolvido ao cancelar.
 * Pedidos de DEMONSTRAÇÃO (preço fictício) nunca mexem no estoque real, como as demais vendas de demonstração.
 */
import { randomBytes } from 'node:crypto';
import { and, asc, count, desc, eq, gt, gte, isNull, lt, or, sql, type SQL } from 'drizzle-orm';
import type { PaymentMethod } from '@/config/payment-methods';
import { PAYMENT_METHOD_LABEL } from '@/config/payment-methods';
import {
  allowedNextStatuses,
  customerStatusMessage,
  DEMO_PIX_KEY,
  FULFILLMENT_LABEL,
  isFinalStoreStatus,
  OPEN_ORDERS_PER_PHONE,
  ORDERS_PER_IP_PER_HOUR,
  ORDERS_UNKNOWN_IP_PER_HOUR,
  STORE_ORDER_STATUS,
  storePaymentLabel,
  type DeliveryAddress,
  type Fulfillment,
  type StoreOrderStatus,
  type StorePaymentMethod,
} from '@/config/store';
import { formatStoreOrderCode, parseStoreOrderCode } from '@/lib/codes';
import { todayISO } from '@/lib/dates';
import { formatBRL } from '@/lib/money';
import { buildPixPayload } from '@/lib/pix';
import { normalizeSearch, onlyDigits } from '@/lib/text';
import { BusinessError, NotFoundError } from '../auth/errors';
import type { Actor } from '../auth/types';
import { getDb, isUniqueViolation, runWrite, type DbOrTx, type Tx } from '../db/client';
import { customers, payments, saleItems, sales, storeOrderEvents, storeOrders, users, type StoreOrder } from '../db/schema';
import { audit } from './audit';
import { createNotification } from './notifications';
import { registerPayment } from './payments';
import { allOf, type PageResult } from './query-utils';
import { cancelSale, createSale } from './sales';
import { getCompanySettings } from './settings';
import { loadStoreProducts } from './store';
import { getStoreSettings } from './store-settings';

// ---------------------------------------------------------------------------
// Criação do pedido (público)
// ---------------------------------------------------------------------------

export interface PlaceOrderInput {
  items: { productId: number; quantity: number }[];
  buyer: { name: string; phone: string; email: string | null };
  fulfillment: Fulfillment;
  address: DeliveryAddress | null;
  paymentMethod: StorePaymentMethod;
  notes: string | null;
}

export interface PlacedOrder {
  id: number;
  number: number;
  token: string;
  isDemo: boolean;
  totalCents: number;
}

/** Telefone do comprador só com dígitos nacionais (sem o 55). */
export function nationalPhoneDigits(input: string): string {
  const digits = onlyDigits(input);
  return digits.length > 11 && digits.startsWith('55') ? digits.slice(2) : digits;
}

async function nextStoreOrderNumber(tx: Tx): Promise<number> {
  const [row] = await tx.select({ max: sql<number>`COALESCE(MAX(${storeOrders.number}), 0)` }).from(storeOrders);
  return Number(row?.max ?? 0) + 1;
}

/** Cliente já cadastrado com exatamente este telefone (só vincula quando há um único cadastro). */
async function findCustomerIdByPhone(tx: Tx, digits: string): Promise<number | null> {
  const rows = await tx
    .select({ id: customers.id, phone: customers.phone, whatsapp: customers.whatsapp })
    .from(customers)
    .where(sql`${customers.searchText} LIKE ${`%${digits}%`}`)
    .limit(5);
  const exact = rows.filter((row) => [nationalPhoneDigits(row.phone ?? ''), nationalPhoneDigits(row.whatsapp ?? '')].includes(digits));
  return exact.length === 1 ? exact[0]!.id : null;
}

export async function placeStoreOrder(input: PlaceOrderInput, ctx: { ip?: string | null; notify?: boolean } = {}): Promise<PlacedOrder> {
  const attempt = () =>
    runWrite(async (tx) => {
      const config = await getStoreSettings(tx);
      if (!config.enabled) throw new BusinessError('A loja virtual está fechada no momento. Fale com a gente pelo WhatsApp.');

      // Pedidos com PIX vencido liberam o estoque antes de conferir a disponibilidade.
      await expireStaleStoreOrders({ force: true });

      // ---- limites contra abuso (checkout público) ----
      const phone = nationalPhoneDigits(input.buyer.phone);
      {
        // Sem IP conhecido (Node exposto direto, sem proxy) vale um teto geral por hora para todos.
        const since = new Date(Date.now() - 3_600_000);
        const [recent] = await tx
          .select({ n: count() })
          .from(storeOrders)
          .where(and(ctx.ip ? eq(storeOrders.createdIp, ctx.ip) : isNull(storeOrders.createdIp), gte(storeOrders.createdAt, since)));
        if (Number(recent?.n ?? 0) >= (ctx.ip ? ORDERS_PER_IP_PER_HOUR : ORDERS_UNKNOWN_IP_PER_HOUR)) {
          throw new BusinessError('Foram feitos muitos pedidos deste aparelho em pouco tempo. Aguarde um pouco ou fale com a gente pelo WhatsApp.');
        }
      }
      const [open] = await tx.select({ n: count() }).from(storeOrders).where(and(eq(storeOrders.buyerPhone, phone), eq(storeOrders.status, 'RECEIVED'), eq(storeOrders.isDemo, false)));
      if (Number(open?.n ?? 0) >= OPEN_ORDERS_PER_PHONE) {
        throw new BusinessError('Você já tem pedidos aguardando confirmação. Aguarde o retorno da loja ou fale com a gente pelo WhatsApp.');
      }

      // ---- itens: preço e estoque são conferidos AGORA, no servidor ----
      const wanted = new Map<number, number>();
      for (const item of input.items) wanted.set(item.productId, (wanted.get(item.productId) ?? 0) + item.quantity);
      if (wanted.size === 0) throw new BusinessError('Seu carrinho está vazio.');
      const catalog = await loadStoreProducts(tx, [...wanted.keys()], config);

      const problems: string[] = [];
      for (const [productId, quantity] of wanted) {
        const product = catalog.get(productId);
        if (!product || product.state === 'CONSULT' || product.priceCents === null) {
          problems.push(product ? `"${product.name}" não está disponível para compra online.` : 'Um dos produtos do carrinho não está mais disponível.');
        } else if (product.available <= 0) {
          problems.push(`"${product.name}" está esgotado.`);
        } else if (quantity > product.available) {
          problems.push(`Só temos ${product.available} ${product.available === 1 ? 'unidade' : 'unidades'} de "${product.name}".`);
        }
      }
      if (problems.length) throw new BusinessError(`${problems.join(' ')} Volte ao carrinho e ajuste o pedido.`);

      const lines = [...wanted].map(([productId, quantity]) => ({ product: catalog.get(productId)!, quantity }));
      const isDemo = lines.some((line) => line.product.isDemoPrice);

      // ---- recebimento e pagamento ----
      if (input.fulfillment === 'DELIVERY') {
        if (!config.deliveryEnabled) throw new BusinessError('A entrega não está disponível no momento. Escolha retirar na loja.', 'fulfillment');
        if (!input.address) throw new BusinessError('Informe o endereço de entrega.');
      }
      if (input.paymentMethod === 'PIX' && !isDemo && !config.pixKey) {
        throw new BusinessError('O pagamento por PIX não está disponível no momento. Escolha pagar na retirada ou fale com a gente pelo WhatsApp.', 'paymentMethod');
      }

      const subtotalCents = lines.reduce((sum, line) => sum + line.product.priceCents! * line.quantity, 0);
      if (config.minOrderCents > 0 && subtotalCents < config.minOrderCents) {
        throw new BusinessError(`O pedido mínimo da loja é ${formatBRL(config.minOrderCents)}.`);
      }
      const freeDelivery = config.freeDeliveryMinCents !== null && config.freeDeliveryMinCents > 0 && subtotalCents >= config.freeDeliveryMinCents;
      const deliveryFeeCents = input.fulfillment === 'DELIVERY' && !freeDelivery ? config.deliveryFeeCents : 0;
      const totalCents = subtotalCents + deliveryFeeCents;

      // ---- venda (estoque, custo e financeiro) + pedido ----
      const company = await getCompanySettings();
      const number = await nextStoreOrderNumber(tx);
      const code = formatStoreOrderCode(number);
      const customerId = await findCustomerIdByPhone(tx, phone);

      const sale = await createSale(
        {
          customerId,
          saleDate: todayISO(company.timezone),
          discountCents: 0,
          notes: `Pedido online ${code} · ${input.buyer.name} · ${FULFILLMENT_LABEL[input.fulfillment]} · ${storePaymentLabel(input.paymentMethod, input.fulfillment)}`,
          items: [
            ...lines.map((line) => ({ productId: line.product.id, description: line.product.name, quantity: line.quantity, unitPriceCents: line.product.priceCents! })),
            ...(deliveryFeeCents > 0 ? [{ productId: null, description: 'Taxa de entrega', quantity: 1, unitPriceCents: deliveryFeeCents, isFee: true }] : []),
          ],
        },
        null,
        { isDemo, channel: 'LOJA' },
      );
      if (sale.totalCents !== totalCents) throw new Error(`Total da venda (${sale.totalCents}) diferente do pedido (${totalCents}).`);

      const token = randomBytes(32).toString('base64url');
      const pixPayload =
        input.paymentMethod === 'PIX'
          ? buildPixPayload({
              // Pedido de demonstração NUNCA usa a chave real: o código só serve para ver como funciona.
              key: isDemo ? DEMO_PIX_KEY : config.pixKey!,
              name: company.name,
              city: company.city ?? '',
              amountCents: totalCents,
              txid: `LJ${String(number).padStart(6, '0')}`,
            })
          : null;

      const [order] = await tx
        .insert(storeOrders)
        .values({
          number,
          token,
          saleId: sale.id,
          status: 'RECEIVED',
          fulfillment: input.fulfillment,
          paymentMethod: input.paymentMethod,
          buyerName: input.buyer.name,
          buyerPhone: phone,
          buyerEmail: input.buyer.email,
          deliveryAddress: input.fulfillment === 'DELIVERY' ? input.address : null,
          notes: input.notes,
          subtotalCents,
          deliveryFeeCents,
          totalCents,
          pixPayload,
          searchText: normalizeSearch([code, input.buyer.name, phone, input.buyer.email].filter(Boolean).join(' ')),
          isDemo,
          createdIp: ctx.ip ?? null,
        })
        .returning();
      await tx.insert(storeOrderEvents).values({ orderId: order!.id, type: 'CREATED', toStatus: 'RECEIVED', message: customerStatusMessage('RECEIVED', input.fulfillment), isPublic: true });

      if (ctx.notify !== false) {
        await createNotification({
          type: 'STORE_ORDER',
          title: `Novo pedido online ${code}`,
          body: `${input.buyer.name} · ${formatBRL(totalCents)} · ${FULFILLMENT_LABEL[input.fulfillment]}`,
          link: `/sistema/loja/${order!.id}`,
          permission: 'store.view',
          isDemo,
        });
      }
      await audit({ action: 'STORE_ORDER_CREATE', entityType: 'store_orders', entityId: order!.id, summary: `${code} recebido (${formatBRL(totalCents)})`, ip: ctx.ip ?? null });

      return { id: order!.id, number, token, isDemo, totalCents };
    });

  // Número sequencial em disputa (outro processo gravou o mesmo número): tenta de novo.
  for (let tries = 0; ; tries++) {
    try {
      return await attempt();
    } catch (error) {
      if (tries < 3 && isUniqueViolation(error) && /store_orders\.number|sales\.number/i.test(String((error as Error).message))) continue;
      throw error;
    }
  }
}

// ---------------------------------------------------------------------------
// Consultas
// ---------------------------------------------------------------------------

const paidSql = sql<number>`COALESCE((SELECT SUM(p.amount_cents) FROM payments p WHERE p.sale_id = ${storeOrders.saleId} AND p.status = 'PAID'), 0)`;

export interface StoreOrderRow {
  id: number;
  number: number;
  createdAt: Date;
  status: StoreOrderStatus;
  fulfillment: Fulfillment;
  paymentMethod: StorePaymentMethod;
  buyerName: string;
  buyerPhone: string;
  totalCents: number;
  paidCents: number;
  itemsCount: number;
  isDemo: boolean;
  saleId: number;
  saleNumber: number;
}

/** Filtros da lista: um status, "ABERTOS" (em andamento) ou "PAGAMENTO" (PIX ainda não pago). */
export type StoreOrderFilter = StoreOrderStatus | 'ABERTOS' | 'PAGAMENTO';
export const STORE_ORDER_FILTERS = ['ABERTOS', 'PAGAMENTO', 'RECEIVED', 'CONFIRMED', 'READY', 'OUT_FOR_DELIVERY', 'COMPLETED', 'CANCELED'] as const;

export async function listStoreOrders(params: { q?: string; filter?: StoreOrderFilter; page?: number; pageSize?: number }): Promise<PageResult<StoreOrderRow>> {
  const db = getDb();
  const pageSize = params.pageSize ?? 20;
  const page = Math.max(1, params.page ?? 1);
  const q = normalizeSearch(params.q);
  const code = params.q ? parseStoreOrderCode(params.q) : null;

  let filter: SQL | undefined;
  if (params.filter === 'ABERTOS') filter = sql`${storeOrders.status} NOT IN ('COMPLETED', 'CANCELED')`;
  else if (params.filter === 'PAGAMENTO') filter = sql`${storeOrders.status} NOT IN ('COMPLETED', 'CANCELED') AND ${storeOrders.paymentMethod} = 'PIX' AND ${paidSql} < ${storeOrders.totalCents}`;
  else if (params.filter) filter = eq(storeOrders.status, params.filter);

  const search = q ? (code ? sql`(${storeOrders.number} = ${code} OR ${storeOrders.searchText} LIKE ${`%${q}%`})` : sql`${storeOrders.searchText} LIKE ${`%${q}%`}`) : undefined;
  const where = allOf(filter, search);

  const rows = await db
    .select({
      id: storeOrders.id,
      number: storeOrders.number,
      createdAt: storeOrders.createdAt,
      status: storeOrders.status,
      fulfillment: storeOrders.fulfillment,
      paymentMethod: storeOrders.paymentMethod,
      buyerName: storeOrders.buyerName,
      buyerPhone: storeOrders.buyerPhone,
      totalCents: storeOrders.totalCents,
      paidCents: paidSql,
      itemsCount: sql<number>`(SELECT COUNT(*) FROM sale_items i WHERE i.sale_id = ${storeOrders.saleId} AND i.is_fee = 0)`,
      isDemo: storeOrders.isDemo,
      saleId: storeOrders.saleId,
      saleNumber: sales.number,
    })
    .from(storeOrders)
    .innerJoin(sales, eq(sales.id, storeOrders.saleId))
    .where(where)
    .orderBy(desc(storeOrders.createdAt), desc(storeOrders.id))
    .limit(pageSize)
    .offset((page - 1) * pageSize);

  const [total] = await db.select({ n: count() }).from(storeOrders).where(where);
  return { rows: rows.map((r) => ({ ...r, paidCents: Number(r.paidCents), itemsCount: Number(r.itemsCount) })), total: Number(total?.n ?? 0) };
}

export interface StoreOrdersSummary {
  received: number;
  awaitingPayment: number;
  ready: number;
  soldMonthCents: number;
  ordersMonth: number;
}

export async function storeOrdersSummary(monthStartMs: number): Promise<StoreOrdersSummary> {
  const [row] = await getDb().all<Record<keyof StoreOrdersSummary, number>>(sql`
    SELECT
      (SELECT COUNT(*) FROM store_orders WHERE status = 'RECEIVED') AS received,
      (SELECT COUNT(*) FROM store_orders o WHERE o.status NOT IN ('COMPLETED', 'CANCELED') AND o.payment_method = 'PIX'
         AND COALESCE((SELECT SUM(p.amount_cents) FROM payments p WHERE p.sale_id = o.sale_id AND p.status = 'PAID'), 0) < o.total_cents) AS awaitingPayment,
      (SELECT COUNT(*) FROM store_orders WHERE status IN ('READY', 'OUT_FOR_DELIVERY')) AS ready,
      (SELECT COALESCE(SUM(total_cents), 0) FROM store_orders WHERE status <> 'CANCELED' AND created_at >= ${monthStartMs}) AS soldMonthCents,
      (SELECT COUNT(*) FROM store_orders WHERE status <> 'CANCELED' AND created_at >= ${monthStartMs}) AS ordersMonth
  `);
  return {
    received: Number(row?.received ?? 0),
    awaitingPayment: Number(row?.awaitingPayment ?? 0),
    ready: Number(row?.ready ?? 0),
    soldMonthCents: Number(row?.soldMonthCents ?? 0),
    ordersMonth: Number(row?.ordersMonth ?? 0),
  };
}

/** Pedidos novos (ainda não confirmados) — selo do menu e alerta. */
export async function countNewStoreOrders(): Promise<number> {
  const [row] = await getDb().select({ n: count() }).from(storeOrders).where(eq(storeOrders.status, 'RECEIVED'));
  return Number(row?.n ?? 0);
}

/** Maior id de pedido já criado (0 se não houver): a "estação de impressão" começa a partir dele. */
export async function latestStoreOrderId(): Promise<number> {
  const [row] = await getDb().select({ id: sql<number>`COALESCE(MAX(${storeOrders.id}), 0)` }).from(storeOrders);
  return Number(row?.id ?? 0);
}

export interface StoreOrderToPrint {
  id: number;
  saleId: number;
  code: string;
}

/**
 * Pedidos criados depois de `afterId`, do mais antigo para o mais novo, para a impressão automática.
 * Pedidos cancelados não são impressos, mas contam no avanço (`upTo`) para não serem reexaminados.
 * Sem novidades, `upTo` devolve o próprio `afterId`.
 */
export async function listStoreOrdersToPrint(afterId: number, limit = 5): Promise<{ upTo: number; orders: StoreOrderToPrint[] }> {
  const rows = await getDb()
    .select({ id: storeOrders.id, saleId: storeOrders.saleId, number: storeOrders.number, status: storeOrders.status })
    .from(storeOrders)
    .where(gt(storeOrders.id, afterId))
    .orderBy(asc(storeOrders.id))
    .limit(limit);
  return {
    upTo: rows.length > 0 ? rows[rows.length - 1]!.id : afterId,
    orders: rows.filter((row) => row.status !== 'CANCELED').map((row) => ({ id: row.id, saleId: row.saleId, code: formatStoreOrderCode(row.number) })),
  };
}

/** O pedido não cancelado mais recente (para "imprimir o último pedido", que serve de teste da impressora). */
export async function latestStoreOrderToPrint(): Promise<StoreOrderToPrint | null> {
  const [row] = await getDb()
    .select({ id: storeOrders.id, saleId: storeOrders.saleId, number: storeOrders.number })
    .from(storeOrders)
    .where(sql`${storeOrders.status} <> 'CANCELED'`)
    .orderBy(desc(storeOrders.id))
    .limit(1);
  return row ? { id: row.id, saleId: row.saleId, code: formatStoreOrderCode(row.number) } : null;
}

export interface StoreOrderBundle {
  order: StoreOrder;
  sale: { id: number; number: number; status: 'ACTIVE' | 'CANCELED'; totalCents: number; customerId: number | null };
  items: { id: number; productId: number | null; description: string; quantity: number; unitPriceCents: number; totalCents: number; isFee: boolean }[];
  payments: { id: number; amountCents: number; method: PaymentMethod; paidDate: string; status: 'PAID' | 'VOIDED'; createdAt: Date }[];
  events: { id: number; type: 'CREATED' | 'STATUS' | 'PAYMENT' | 'NOTE'; toStatus: StoreOrderStatus | null; message: string | null; isPublic: boolean; userName: string | null; createdAt: Date }[];
  paidCents: number;
  balanceCents: number;
}

async function loadBundle(db: DbOrTx, where: SQL): Promise<StoreOrderBundle | null> {
  const [order] = await db.select().from(storeOrders).where(where).limit(1);
  if (!order) return null;
  const [sale] = await db.select({ id: sales.id, number: sales.number, status: sales.status, totalCents: sales.totalCents, customerId: sales.customerId }).from(sales).where(eq(sales.id, order.saleId)).limit(1);
  if (!sale) return null;
  const items = await db
    .select({ id: saleItems.id, productId: saleItems.productId, description: saleItems.description, quantity: saleItems.quantity, unitPriceCents: saleItems.unitPriceCents, totalCents: saleItems.totalCents, isFee: saleItems.isFee })
    .from(saleItems)
    .where(eq(saleItems.saleId, order.saleId))
    .orderBy(asc(saleItems.position), asc(saleItems.id));
  const salePayments = await db
    .select({ id: payments.id, amountCents: payments.amountCents, method: payments.method, paidDate: payments.paidDate, status: payments.status, createdAt: payments.createdAt })
    .from(payments)
    .where(eq(payments.saleId, order.saleId))
    .orderBy(asc(payments.createdAt), asc(payments.id));
  const events = await db
    .select({ id: storeOrderEvents.id, type: storeOrderEvents.type, toStatus: storeOrderEvents.toStatus, message: storeOrderEvents.message, isPublic: storeOrderEvents.isPublic, userName: users.name, createdAt: storeOrderEvents.createdAt })
    .from(storeOrderEvents)
    .leftJoin(users, eq(users.id, storeOrderEvents.userId))
    .where(eq(storeOrderEvents.orderId, order.id))
    .orderBy(asc(storeOrderEvents.createdAt), asc(storeOrderEvents.id));
  const paidCents = salePayments.filter((p) => p.status === 'PAID').reduce((sum, p) => sum + p.amountCents, 0);
  return { order, sale, items, payments: salePayments, events, paidCents, balanceCents: Math.max(0, order.totalCents - paidCents) };
}

export function getStoreOrderDetail(id: number): Promise<StoreOrderBundle | null> {
  return loadBundle(getDb(), eq(storeOrders.id, id));
}

const TOKEN_RE = /^[A-Za-z0-9_-]{43}$/;

/** Acompanhamento público: só quem tem o link (token de 256 bits) acessa. */
export async function getStoreOrderByToken(token: string): Promise<StoreOrderBundle | null> {
  if (!TOKEN_RE.test(token)) return null;
  return loadBundle(getDb(), eq(storeOrders.token, token));
}

// ---------------------------------------------------------------------------
// Atendimento (equipe)
// ---------------------------------------------------------------------------

async function loadOrder(tx: Tx, id: number): Promise<StoreOrder> {
  const [order] = await tx.select().from(storeOrders).where(eq(storeOrders.id, id)).limit(1);
  if (!order) throw new NotFoundError('Pedido');
  return order;
}

async function saleBalance(tx: Tx, saleId: number, totalCents: number): Promise<number> {
  const [row] = await tx
    .select({ paid: sql<number>`COALESCE(SUM(${payments.amountCents}), 0)` })
    .from(payments)
    .where(and(eq(payments.saleId, saleId), eq(payments.status, 'PAID')));
  return Math.max(0, totalCents - Number(row?.paid ?? 0));
}

async function addEvent(tx: Tx, orderId: number, event: { type: 'STATUS' | 'PAYMENT' | 'NOTE'; toStatus?: StoreOrderStatus | null; message: string; isPublic: boolean; userId?: number | null }): Promise<void> {
  await tx.insert(storeOrderEvents).values({
    orderId,
    type: event.type,
    toStatus: event.toStatus ?? null,
    message: event.message,
    isPublic: event.isPublic,
    userId: event.userId ?? null,
  });
}

/** Avança o pedido (confirmar → pronto → saiu para entrega → concluído). Cancelar é uma ação à parte. */
export async function changeStoreOrderStatus(
  id: number,
  to: StoreOrderStatus,
  actor: Actor,
  opts: { paymentMethod?: PaymentMethod | null } = {},
): Promise<StoreOrder> {
  if (to === 'CANCELED') throw new BusinessError('Para cancelar use a ação "Cancelar pedido".');
  return runWrite(async (tx) => {
    const order = await loadOrder(tx, id);
    const code = formatStoreOrderCode(order.number);
    if (!allowedNextStatuses(order.status, order.fulfillment).includes(to)) {
      throw new BusinessError(`O pedido ${code} está "${STORE_ORDER_STATUS[order.status].label}" e não pode ir para "${STORE_ORDER_STATUS[to].label}".`);
    }

    if (to === 'COMPLETED') {
      const balance = await saleBalance(tx, order.saleId, order.totalCents);
      if (balance > 0) {
        if (!opts.paymentMethod) throw new BusinessError('Informe a forma de pagamento recebida para concluir o pedido.', 'paymentMethod');
        await registerPayment(
          { saleId: order.saleId, amountCents: balance, method: opts.paymentMethod, paidDate: todayISO((await getCompanySettings()).timezone), description: `Pedido online ${code}` },
          actor,
          { isDemo: order.isDemo },
        );
        await addEvent(tx, id, { type: 'PAYMENT', message: `Pagamento de ${formatBRL(balance)} recebido (${PAYMENT_METHOD_LABEL[opts.paymentMethod]}).`, isPublic: true, userId: actor.id });
      }
    }

    const now = new Date();
    const [updated] = await tx
      .update(storeOrders)
      .set({
        status: to,
        ...(to === 'CONFIRMED' ? { confirmedAt: now } : {}),
        ...(to === 'READY' ? { readyAt: now, confirmedAt: order.confirmedAt ?? now } : {}),
        ...(to === 'COMPLETED' ? { completedAt: now, confirmedAt: order.confirmedAt ?? now } : {}),
      })
      .where(eq(storeOrders.id, id))
      .returning();
    await addEvent(tx, id, { type: 'STATUS', toStatus: to, message: customerStatusMessage(to, order.fulfillment), isPublic: true, userId: actor.id });
    await audit({ actor, action: 'STORE_ORDER_STATUS', entityType: 'store_orders', entityId: id, summary: `${code}: ${STORE_ORDER_STATUS[order.status].label} → ${STORE_ORDER_STATUS[to].label}` });
    return updated!;
  });
}

/** Confirma o recebimento do PIX (ou de outra forma) pelo saldo em aberto e confirma o pedido. */
export async function confirmStorePayment(id: number, actor: Actor, method: PaymentMethod = 'PIX'): Promise<StoreOrder> {
  return runWrite(async (tx) => {
    const order = await loadOrder(tx, id);
    const code = formatStoreOrderCode(order.number);
    if (order.status === 'CANCELED') throw new BusinessError('Este pedido foi cancelado.');
    const balance = await saleBalance(tx, order.saleId, order.totalCents);
    if (balance <= 0) throw new BusinessError('Este pedido já está totalmente pago.');

    await registerPayment(
      { saleId: order.saleId, amountCents: balance, method, paidDate: todayISO((await getCompanySettings()).timezone), description: `Pedido online ${code}` },
      actor,
      { isDemo: order.isDemo },
    );
    await addEvent(tx, id, { type: 'PAYMENT', message: `Pagamento de ${formatBRL(balance)} confirmado (${PAYMENT_METHOD_LABEL[method]}). Obrigado!`, isPublic: true, userId: actor.id });

    let updated: StoreOrder = order;
    if (order.status === 'RECEIVED') {
      const rows = await tx.update(storeOrders).set({ status: 'CONFIRMED', confirmedAt: new Date() }).where(eq(storeOrders.id, id)).returning();
      updated = rows[0] ?? order;
      await addEvent(tx, id, { type: 'STATUS', toStatus: 'CONFIRMED', message: customerStatusMessage('CONFIRMED', order.fulfillment), isPublic: true, userId: actor.id });
    }
    await audit({ actor, action: 'STORE_ORDER_PAYMENT', entityType: 'store_orders', entityId: id, summary: `${code}: pagamento de ${formatBRL(balance)} confirmado (${PAYMENT_METHOD_LABEL[method]})` });
    return updated;
  });
}

/** Cancela o pedido: devolve o estoque e estorna pagamentos (o cancelamento da venda vinculada faz isso). */
export async function cancelStoreOrder(id: number, reason: string | null, actor: Actor | null): Promise<void> {
  await runWrite(async (tx) => {
    const order = await loadOrder(tx, id);
    if (isFinalStoreStatus(order.status)) {
      throw new BusinessError(order.status === 'CANCELED' ? 'Este pedido já foi cancelado.' : 'Pedido concluído não pode ser cancelado por aqui. Cancele a venda correspondente, se necessário.');
    }
    // `cancelSale` também marca o pedido da loja como cancelado (mantém tudo em sincronia).
    await cancelSale(order.saleId, reason, actor);
  });
}

/** Observação na linha do tempo; "pública" aparece para o cliente no link de acompanhamento. */
export async function addStoreOrderNote(id: number, message: string, isPublic: boolean, actor: Actor): Promise<void> {
  await runWrite(async (tx) => {
    const order = await loadOrder(tx, id);
    await addEvent(tx, id, { type: 'NOTE', message, isPublic, userId: actor.id });
    await audit({ actor, action: 'STORE_ORDER_NOTE', entityType: 'store_orders', entityId: id, summary: `${formatStoreOrderCode(order.number)}: observação ${isPublic ? 'pública' : 'interna'}` });
  });
}

// ---------------------------------------------------------------------------
// Expiração de pedidos com PIX não pago
// ---------------------------------------------------------------------------

let lastSweepAt = 0;

/** Pedidos para pagar na retirada que a equipe não confirma valem 3× o prazo do PIX (fins de semana e feriados). */
const UNCONFIRMED_HOLD_FACTOR = 3;

/**
 * Libera o estoque reservado por pedidos abandonados (o estoque é reservado assim que o pedido é feito):
 *  - PIX sem pagamento depois de `hold_hours`;
 *  - pedidos "pagar na retirada" que a equipe não confirmou em 3× `hold_hours` (evita travar o estoque com pedidos falsos).
 * Pedidos confirmados e os de demonstração nunca expiram. Consulta barata: roda no máximo 1x por minuto, salvo com `force`.
 */
export async function expireStaleStoreOrders(opts: { force?: boolean; now?: Date } = {}): Promise<number> {
  if (!opts.force && Date.now() - lastSweepAt < 60_000) return 0;
  lastSweepAt = Date.now();
  const config = await getStoreSettings();
  if (config.holdHours <= 0) return 0;
  const now = (opts.now ?? new Date()).getTime();
  const pixCutoff = new Date(now - config.holdHours * 3_600_000);
  const unconfirmedCutoff = new Date(now - config.holdHours * UNCONFIRMED_HOLD_FACTOR * 3_600_000);

  const stale = await getDb()
    .select({ id: storeOrders.id, paymentMethod: storeOrders.paymentMethod })
    .from(storeOrders)
    .where(
      and(
        eq(storeOrders.status, 'RECEIVED'),
        eq(storeOrders.isDemo, false),
        or(
          and(eq(storeOrders.paymentMethod, 'PIX'), lt(storeOrders.createdAt, pixCutoff)),
          and(eq(storeOrders.paymentMethod, 'ON_SITE'), lt(storeOrders.createdAt, unconfirmedCutoff)),
        ),
        sql`NOT EXISTS (SELECT 1 FROM payments p WHERE p.sale_id = ${storeOrders.saleId} AND p.status = 'PAID')`,
      ),
    );
  if (stale.length === 0) return 0;

  let canceled = 0;
  for (const order of stale) {
    const reason =
      order.paymentMethod === 'PIX'
        ? `Pagamento PIX não confirmado em ${config.holdHours} h — pedido cancelado automaticamente.`
        : `Pedido não confirmado pela loja em ${config.holdHours * UNCONFIRMED_HOLD_FACTOR} h — cancelado automaticamente.`;
    try {
      await cancelStoreOrder(order.id, reason, null);
      canceled++;
    } catch {
      /* outro processo já tratou este pedido */
    }
  }
  return canceled;
}

/** Só para testes: zera o controle de frequência da varredura. */
export function resetStoreSweepThrottle(): void {
  lastSweepAt = 0;
}

import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { and, asc, count, eq, gte, isNull, sql } from 'drizzle-orm';
import { SaleSheet } from '@/components/documents/OrderSheets';
import { formatSaleCode, formatStoreOrderCode } from '@/lib/codes';
import { addDaysISO, todayISO } from '@/lib/dates';
import { isValidPixPayload } from '@/lib/pix';
import { DEMO_PIX_KEY, DEMO_STORE_STOCK, ORDERS_PER_IP_PER_HOUR, ORDERS_UNKNOWN_IP_PER_HOUR, STORE_DEFAULTS } from '@/config/store';
import type { Actor } from '@/server/auth/types';
import { getDb, runWrite } from '@/server/db/client';
import { notifications, payments, products, saleItems, sales, storeOrderEvents, storeOrders } from '@/server/db/schema';
import { getTopProducts } from '@/server/services/dashboard';
import { clearDemoData, countDemoData, hasDemoData } from '@/server/services/demo';
import { createCustomer } from '@/server/services/customers';
import { buildReceiptDocument, buildSaleDocument } from '@/server/documents/model';
import { renderSalePdf } from '@/server/documents/pdf/documents';
import { getSystemAlerts } from '@/server/services/notifications';
import { globalSearch } from '@/server/services/search';
import { adjustStock } from '@/server/services/products';
import { cancelSale, createSale, getSaleDetail, listSales } from '@/server/services/sales';
import { getStoreProduct, listStoreProducts, resolveCart, storeHasDemoPrices } from '@/server/services/store';
import {
  addStoreOrderNote,
  cancelStoreOrder,
  changeStoreOrderStatus,
  confirmStorePayment,
  countNewStoreOrders,
  expireStaleStoreOrders,
  getStoreOrderByToken,
  getStoreOrderDetail,
  latestStoreOrderId,
  latestStoreOrderToPrint,
  listStoreOrders,
  listStoreOrdersToPrint,
  placeStoreOrder,
  storeOrdersSummary,
  type PlaceOrderInput,
} from '@/server/services/store-orders';
import { getStoreSettings, updateStoreSettings } from '@/server/services/store-settings';
import { setupTestDb, teardownTestDb } from '../helpers/db';

let actor: Actor;
const today = todayISO('America/Recife');
const ids: Record<string, number> = {};
let phoneCounter = 0;
let ipCounter = 0;

/** Cada pedido de teste sai de um IP diferente (o teto por IP é testado à parte). */
const nextIp = () => `10.20.${Math.floor(ipCounter / 250)}.${(ipCounter++ % 250) + 1}`;

const REAL_PIX = { ...STORE_DEFAULTS, pixKey: '+5581996405805', pixKeyType: 'PHONE' as const };

async function stockOf(id: number): Promise<number> {
  const [row] = await getDb().select({ stock: products.stock }).from(products).where(eq(products.id, id));
  return row!.stock;
}

function buyer() {
  phoneCounter++;
  return { name: `Cliente Teste ${phoneCounter}`, phone: `(81) 98888-${String(phoneCounter).padStart(4, '0')}`, email: null };
}

function place(items: [string, number][], extra: Partial<PlaceOrderInput> = {}, ctx: { ip?: string | null; notify?: boolean } = {}) {
  return placeStoreOrder(
    {
      items: items.map(([name, quantity]) => ({ productId: ids[name]!, quantity })),
      buyer: buyer(),
      fulfillment: 'PICKUP',
      address: null,
      paymentMethod: 'ON_SITE',
      notes: null,
      ...extra,
    },
    { ip: nextIp(), ...ctx },
  );
}

async function orderRow(id: number) {
  const [row] = await getDb().select().from(storeOrders).where(eq(storeOrders.id, id));
  return row!;
}

beforeAll(async () => {
  ({ actor } = await setupTestDb('store'));
  const rows = await getDb().select({ id: products.id, name: products.name }).from(products);
  for (const row of rows) ids[row.name] = row.id;

  const set = (name: string, values: Partial<typeof products.$inferInsert>) => getDb().update(products).set(values).where(eq(products.id, ids[name]!));
  await set('Rolamentos', { salePriceCents: 5000, costCents: 2000 });
  await adjustStock(ids['Rolamentos']!, { mode: 'ADD', quantity: 100, note: 'teste' }, actor);
  await set('Capacitor permanente', { salePriceCents: 3000, costCents: 1000 });
  await adjustStock(ids['Capacitor permanente']!, { mode: 'ADD', quantity: 3, note: 'teste' }, actor);
  await set('Rotor', { salePriceCents: 9000 }); // esgotado (estoque 0)
  await set('Ventoinha', { demoPriceCents: 4000 }); // só preço de demonstração
  // "Polia" fica sem preço; "Manômetro" não é vendido online
  await set('Manômetro', { salePriceCents: 4500, sellOnline: false });
  await adjustStock(ids['Manômetro']!, { mode: 'ADD', quantity: 5, note: 'teste' }, actor);
  await updateStoreSettings(REAL_PIX, actor);
});

afterAll(() => teardownTestDb());

describe('catálogo da loja', () => {
  it('mostra os 13 produtos oficiais; só compra quem tem preço, estoque e venda online', async () => {
    const catalog = await listStoreProducts();
    expect(catalog.products).toHaveLength(13);
    const byName = new Map(catalog.products.map((p) => [p.name, p]));
    expect(byName.get('Rolamentos')).toMatchObject({ priceCents: 5000, purchasable: true, state: 'AVAILABLE', isDemoPrice: false, available: 100 });
    expect(byName.get('Capacitor permanente')).toMatchObject({ purchasable: true, state: 'LAST_UNITS', available: 3 });
    expect(byName.get('Rotor')).toMatchObject({ priceCents: 9000, purchasable: false, state: 'OUT_OF_STOCK' });
    expect(byName.get('Polia')).toMatchObject({ priceCents: null, purchasable: false, state: 'CONSULT' });
    expect(byName.get('Manômetro')).toMatchObject({ purchasable: false, state: 'CONSULT' });
    expect(byName.get('Ventoinha')).toMatchObject({ priceCents: 4000, isDemoPrice: true, purchasable: true, available: DEMO_STORE_STOCK });
    expect(catalog.demo).toBe(true);
    expect(await storeHasDemoPrices()).toBe(true);
  });

  it('busca sem acento, filtro por categoria e ordenação por preço (sem preço vai para o fim)', async () => {
    const search = await listStoreProducts({ q: 'capacitor' });
    expect(search.products.map((p) => p.name).sort()).toEqual(['Capacitor eletrolítico', 'Capacitor permanente']);
    expect((await listStoreProducts({ q: 'ROLAMENTO' })).products.map((p) => p.name)).toEqual(['Rolamentos']);
    expect((await listStoreProducts({ category: 'Inexistente' })).products).toEqual([]);

    const cheap = (await listStoreProducts({ sort: 'menor-preco' })).products;
    const priced = cheap.filter((p) => p.priceCents !== null);
    expect(priced.map((p) => p.priceCents)).toEqual([...priced.map((p) => p.priceCents)].sort((a, b) => a! - b!));
    expect(cheap.slice(priced.length).every((p) => p.priceCents === null)).toBe(true);
    const dear = (await listStoreProducts({ sort: 'maior-preco' })).products;
    expect(dear[0]!.priceCents).toBe(9000);
  });

  it('produto oculto do site ou inativo não aparece na loja nem tem página', async () => {
    await getDb().update(products).set({ showOnSite: false }).where(eq(products.id, ids['Platinado']!));
    await getDb().update(products).set({ isActive: false }).where(eq(products.id, ids['Centrífugo']!));
    const names = (await listStoreProducts()).products.map((p) => p.name);
    expect(names).not.toContain('Platinado');
    expect(names).not.toContain('Centrífugo');
    expect(await getStoreProduct(ids['Platinado']!)).toBeNull();
    expect(await getStoreProduct(ids['Rolamentos']!)).not.toBeNull();
    await getDb().update(products).set({ showOnSite: true }).where(eq(products.id, ids['Platinado']!));
    await getDb().update(products).set({ isActive: true }).where(eq(products.id, ids['Centrífugo']!));
  });

  it('a loja fechada oferece só "consultar" e não vende', async () => {
    await updateStoreSettings({ ...REAL_PIX, enabled: false }, actor);
    const catalog = await listStoreProducts();
    expect(catalog.products.every((p) => !p.purchasable)).toBe(true);
    await expect(place([['Rolamentos', 1]])).rejects.toThrow(/loja virtual está fechada/);
    await updateStoreSettings(REAL_PIX, actor);
  });
});

describe('carrinho', () => {
  it('confere preço, estoque e problemas linha a linha (o servidor decide)', async () => {
    const result = await resolveCart([
      { id: ids['Rolamentos'], qty: 2 },
      { id: ids['Capacitor permanente'], qty: 5 },
      { id: ids['Rotor'], qty: 1 },
      { id: ids['Polia'], qty: 1 },
      { id: 999999, qty: 1 },
    ]);
    expect(result.missingIds).toEqual([999999]);
    const byName = new Map(result.lines.map((l) => [l.name, l]));
    expect(byName.get('Rolamentos')).toMatchObject({ issue: null, unitPriceCents: 5000, lineTotalCents: 10000 });
    expect(byName.get('Capacitor permanente')).toMatchObject({ issue: 'INSUFFICIENT', available: 3, lineTotalCents: 15000 });
    expect(byName.get('Rotor')).toMatchObject({ issue: 'OUT_OF_STOCK', lineTotalCents: 0 });
    expect(byName.get('Polia')).toMatchObject({ issue: 'UNAVAILABLE', lineTotalCents: 0 });
    expect(result.hasIssues).toBe(true);
    expect(result.subtotalCents).toBe(25000);
  });

  it('carrinho vazio, inválido ou com lixo não quebra; demonstração é sinalizada', async () => {
    expect(await resolveCart([])).toEqual({ lines: [], missingIds: [], subtotalCents: 0, hasDemo: false, hasIssues: false });
    expect((await resolveCart('lixo')).lines).toEqual([]);
    const demo = await resolveCart([{ id: ids['Ventoinha'], qty: 2 }]);
    expect(demo.hasDemo).toBe(true);
    expect(demo.subtotalCents).toBe(8000);
  });
});

describe('pedido: criação', () => {
  it('cria pedido + venda (canal LOJA), baixa o estoque, guarda custo e avisa a equipe', async () => {
    const before = await stockOf(ids['Rolamentos']!);
    const placed = await place([['Rolamentos', 3]], { notes: 'Preciso do rolamento 6204' }, { ip: '10.0.0.1' });
    expect(placed.number).toBe(1);
    expect(placed.token).toMatch(/^[A-Za-z0-9_-]{43}$/);
    expect(placed.isDemo).toBe(false);
    expect(placed.totalCents).toBe(15000);
    expect(await stockOf(ids['Rolamentos']!)).toBe(before - 3);

    const order = await orderRow(placed.id);
    expect(order).toMatchObject({ status: 'RECEIVED', fulfillment: 'PICKUP', paymentMethod: 'ON_SITE', subtotalCents: 15000, deliveryFeeCents: 0, totalCents: 15000, notes: 'Preciso do rolamento 6204', createdIp: '10.0.0.1', pixPayload: null });
    expect(order.buyerPhone).toMatch(/^\d{10,11}$/);

    const detail = await getSaleDetail(order.saleId);
    expect(detail!.sale).toMatchObject({ channel: 'LOJA', status: 'ACTIVE', totalCents: 15000, isDemo: false, createdBy: null });
    expect(detail!.sale.notes).toContain('LJ-000001');
    expect(detail!.items).toHaveLength(1);
    expect(detail!.items[0]).toMatchObject({ description: 'Rolamentos', quantity: 3, unitPriceCents: 5000, unitCostCents: 2000, isFee: false });
    expect(detail!.storeOrder).toMatchObject({ id: placed.id, number: 1 });

    const [note] = await getDb().select().from(notifications).where(eq(notifications.type, 'STORE_ORDER'));
    expect(note).toMatchObject({ title: 'Novo pedido online LJ-000001', permission: 'store.view', link: `/sistema/loja/${placed.id}`, isDemo: false });
    const events = await getDb().select().from(storeOrderEvents).where(eq(storeOrderEvents.orderId, placed.id));
    expect(events).toHaveLength(1);
    expect(events[0]).toMatchObject({ type: 'CREATED', toStatus: 'RECEIVED', isPublic: true });
  });

  it('pedido com PIX guarda o "copia e cola" válido com valor, chave real e identificador', async () => {
    const placed = await place([['Rolamentos', 1], ['Capacitor permanente', 1]], { paymentMethod: 'PIX' });
    const order = await orderRow(placed.id);
    expect(order.pixPayload).toBeTruthy();
    expect(isValidPixPayload(order.pixPayload!)).toBe(true);
    expect(order.pixPayload).toContain('+5581996405805');
    expect(order.pixPayload).toContain('540580.00');
    expect(order.pixPayload).toContain(`LJ${String(placed.number).padStart(6, '0')}`);
    expect(order.pixPayload).toContain('LA MOTORES E BOMBAS');
  });

  it('a chave PIX guardada no pedido não muda se a empresa trocar de chave depois', async () => {
    const placed = await place([['Rolamentos', 1]], { paymentMethod: 'PIX' });
    const original = (await orderRow(placed.id)).pixPayload;
    await updateStoreSettings({ ...REAL_PIX, pixKey: 'nova@empresa.com.br', pixKeyType: 'EMAIL' }, actor);
    expect((await orderRow(placed.id)).pixPayload).toBe(original);
    const next = await place([['Rolamentos', 1]], { paymentMethod: 'PIX' });
    expect((await orderRow(next.id)).pixPayload).toContain('nova@empresa.com.br');
    await updateStoreSettings(REAL_PIX, actor);
  });

  it('sem chave PIX cadastrada a loja não aceita PIX (mas aceita pagar na retirada)', async () => {
    await updateStoreSettings(STORE_DEFAULTS, actor);
    await expect(place([['Rolamentos', 1]], { paymentMethod: 'PIX' })).rejects.toThrow(/PIX não está disponível/);
    await expect(place([['Rolamentos', 1]], { paymentMethod: 'ON_SITE' })).resolves.toBeTruthy();
    await updateStoreSettings(REAL_PIX, actor);
  });

  it('recusa estoque insuficiente, esgotado, sem preço e não vendido online — sem gravar nada', async () => {
    const stockBefore = await stockOf(ids['Capacitor permanente']!);
    const rolamentosBefore = await stockOf(ids['Rolamentos']!);
    const salesBefore = (await getDb().select().from(sales)).length;
    const ordersBefore = (await getDb().select().from(storeOrders)).length;

    await expect(place([['Capacitor permanente', stockBefore + 1]])).rejects.toThrow(/Só temos \d+ (unidade|unidades) de "Capacitor permanente"/);
    await expect(place([['Rotor', 1]])).rejects.toThrow(/"Rotor" está esgotado/);
    await expect(place([['Polia', 1]])).rejects.toThrow(/"Polia" não está disponível para compra online/);
    await expect(place([['Manômetro', 1]])).rejects.toThrow(/"Manômetro" não está disponível para compra online/);
    await expect(place([['Rolamentos', 1], ['Rotor', 1]])).rejects.toThrow(/esgotado/);
    await expect(placeStoreOrder({ items: [], buyer: buyer(), fulfillment: 'PICKUP', address: null, paymentMethod: 'ON_SITE', notes: null })).rejects.toThrow(/carrinho está vazio/);
    await expect(placeStoreOrder({ items: [{ productId: 999999, quantity: 1 }], buyer: buyer(), fulfillment: 'PICKUP', address: null, paymentMethod: 'ON_SITE', notes: null })).rejects.toThrow(/não está mais disponível/);

    expect(await stockOf(ids['Capacitor permanente']!)).toBe(stockBefore);
    expect(await stockOf(ids['Rolamentos']!)).toBe(rolamentosBefore);
    expect((await getDb().select().from(sales)).length).toBe(salesBefore);
    expect((await getDb().select().from(storeOrders)).length).toBe(ordersBefore);
  });

  it('soma itens repetidos do mesmo produto antes de conferir o estoque', async () => {
    const stock = await stockOf(ids['Capacitor permanente']!);
    await expect(
      placeStoreOrder({
        items: [
          { productId: ids['Capacitor permanente']!, quantity: stock },
          { productId: ids['Capacitor permanente']!, quantity: 1 },
        ],
        buyer: buyer(),
        fulfillment: 'PICKUP',
        address: null,
        paymentMethod: 'ON_SITE',
        notes: null,
      }),
    ).rejects.toThrow(/Só temos/);
  });

  it('pedido mínimo é respeitado', async () => {
    await updateStoreSettings({ ...REAL_PIX, minOrderCents: 10000 }, actor);
    await expect(place([['Rolamentos', 1]])).rejects.toThrow(/pedido mínimo da loja é R\$\s?100,00/);
    await expect(place([['Rolamentos', 2]])).resolves.toBeTruthy();
    await updateStoreSettings(REAL_PIX, actor);
  });
});

describe('pedido: entrega', () => {
  const address = { zip: '54000-000', street: 'Rua Serafim Luiz Pinto', number: '15', complement: null, district: 'Centro', city: 'Jaboatão dos Guararapes', state: 'PE' };

  it('entrega desativada é recusada; ativada soma a taxa como linha própria (fora dos rankings)', async () => {
    await expect(place([['Rolamentos', 1]], { fulfillment: 'DELIVERY', address })).rejects.toThrow(/entrega não está disponível/);

    await updateStoreSettings({ ...REAL_PIX, deliveryEnabled: true, deliveryFeeCents: 1500, freeDeliveryMinCents: 20000 }, actor);
    await expect(place([['Rolamentos', 1]], { fulfillment: 'DELIVERY', address: null })).rejects.toThrow(/endereço de entrega/);

    const placed = await place([['Rolamentos', 1]], { fulfillment: 'DELIVERY', address });
    expect(placed.totalCents).toBe(6500);
    const order = await orderRow(placed.id);
    expect(order).toMatchObject({ subtotalCents: 5000, deliveryFeeCents: 1500, totalCents: 6500, fulfillment: 'DELIVERY' });
    expect(order.deliveryAddress).toEqual(address);
    const items = await getDb().select().from(saleItems).where(eq(saleItems.saleId, order.saleId)).orderBy(asc(saleItems.position));
    expect(items.map((i) => [i.description, i.isFee, i.productId === null])).toEqual([['Rolamentos', false, false], ['Taxa de entrega', true, true]]);
    expect((await getDb().select().from(sales).where(eq(sales.id, order.saleId)))[0]!.totalCents).toBe(6500);

    const top = await getTopProducts(addDaysISO(today, -1), today, 20);
    expect(top.map((t) => t.name)).not.toContain('Taxa de entrega');
    expect(top.map((t) => t.name)).toContain('Rolamentos');
    const list = await listSales({ pageSize: 100 });
    expect(list.rows.find((r) => r.id === order.saleId)).toMatchObject({ itemsCount: 1, channel: 'LOJA', storeOrderNumber: placed.number });
  });

  it('frete grátis a partir do valor definido; retirada nunca paga taxa', async () => {
    const free = await place([['Rolamentos', 4]], { fulfillment: 'DELIVERY', address });
    expect(free.totalCents).toBe(20000);
    expect((await orderRow(free.id)).deliveryFeeCents).toBe(0);
    const pickup = await place([['Rolamentos', 1]]);
    expect((await orderRow(pickup.id)).deliveryFeeCents).toBe(0);
    await updateStoreSettings(REAL_PIX, actor);
  });
});

describe('pedido de demonstração', () => {
  it('preço fictício gera pedido de demonstração: não mexe no estoque real e o PIX usa chave inexistente', async () => {
    const stockBefore = await stockOf(ids['Ventoinha']!);
    const placed = await place([['Ventoinha', 2]], { paymentMethod: 'PIX' });
    expect(placed.isDemo).toBe(true);
    expect(placed.totalCents).toBe(8000);
    expect(await stockOf(ids['Ventoinha']!)).toBe(stockBefore);
    const order = await orderRow(placed.id);
    expect(order.isDemo).toBe(true);
    expect(order.pixPayload).toContain(DEMO_PIX_KEY);
    expect(order.pixPayload).not.toContain('+5581996405805');
    const sale = (await getDb().select().from(sales).where(eq(sales.id, order.saleId)))[0]!;
    expect(sale).toMatchObject({ isDemo: true, channel: 'LOJA' });
    const [note] = await getDb().select().from(notifications).where(eq(notifications.title, `Novo pedido online LJ-${String(placed.number).padStart(6, '0')}`));
    expect(note!.isDemo).toBe(true);
  });

  it('demonstração aceita PIX mesmo sem chave cadastrada (só para ver como funciona)', async () => {
    await updateStoreSettings(STORE_DEFAULTS, actor);
    const placed = await place([['Ventoinha', 1]], { paymentMethod: 'PIX' });
    expect((await orderRow(placed.id)).pixPayload).toContain(DEMO_PIX_KEY);
    await updateStoreSettings(REAL_PIX, actor);
  });

  it('carrinho misto (real + demonstração) vira pedido de demonstração inteiro e não baixa nem o estoque real', async () => {
    const stockBefore = await stockOf(ids['Rolamentos']!);
    const placed = await place([['Rolamentos', 2], ['Ventoinha', 1]]);
    expect(placed.isDemo).toBe(true);
    expect(await stockOf(ids['Rolamentos']!)).toBe(stockBefore);
  });
});

describe('limites contra abuso', () => {
  it('limita pedidos por IP em uma hora', async () => {
    const ip = '10.9.9.9';
    for (let i = 0; i < ORDERS_PER_IP_PER_HOUR; i++) await place([['Rolamentos', 1]], {}, { ip, notify: false });
    await expect(place([['Rolamentos', 1]], {}, { ip })).rejects.toThrow(/muitos pedidos deste aparelho/);
    // outro IP e pedidos sem IP continuam funcionando
    await expect(place([['Rolamentos', 1]], {}, { ip: '10.9.9.10' })).resolves.toBeTruthy();
  });

  it('sem IP conhecido (servidor exposto sem proxy) vale um teto geral por hora', async () => {
    const [existing] = await getDb().select({ n: count() }).from(storeOrders).where(and(isNull(storeOrders.createdIp), gte(storeOrders.createdAt, new Date(Date.now() - 3_600_000))));
    // pedidos de demonstração (Ventoinha): não reservam estoque real nem contam no limite por telefone
    for (let i = 0; i < ORDERS_UNKNOWN_IP_PER_HOUR - Number(existing!.n); i++) await place([['Ventoinha', 1]], {}, { ip: null, notify: false });
    await expect(place([['Ventoinha', 1]], {}, { ip: null })).rejects.toThrow(/muitos pedidos deste aparelho/);
    // com IP conhecido o pedido segue normalmente
    await expect(place([['Ventoinha', 1]], {}, { notify: false })).resolves.toBeTruthy();
  });

  it('limita pedidos aguardando confirmação por telefone', async () => {
    const same = { name: 'Fulano Repetido', phone: '(81) 97777-0001', email: null };
    for (let i = 0; i < 3; i++) await place([['Rolamentos', 1]], { buyer: same }, { notify: false });
    await expect(place([['Rolamentos', 1]], { buyer: same })).rejects.toThrow(/já tem pedidos aguardando confirmação/);
    // formatos diferentes do mesmo telefone contam como o mesmo
    await expect(place([['Rolamentos', 1]], { buyer: { ...same, phone: '5581977770001' } })).rejects.toThrow(/aguardando/);
  });
});

describe('vínculo com o cadastro de clientes', () => {
  const base = { document: null, email: null, address: null, notes: null, whatsapp: null };

  it('liga ao cliente pelo telefone só quando há um único cadastro; nunca cria clientes sozinho', async () => {
    const unique = await createCustomer({ ...base, name: 'Cliente Único', phone: '(81) 96666-0001' }, actor);
    await createCustomer({ ...base, name: 'Duplicado A', phone: '(81) 96666-0002' }, actor);
    await createCustomer({ ...base, name: 'Duplicado B', phone: '(81) 96666-0002' }, actor);

    const linked = await place([['Rolamentos', 1]], { buyer: { name: 'Qualquer Nome', phone: '(81) 96666-0001', email: null } }, { notify: false });
    const linkedSale = (await getSaleDetail((await orderRow(linked.id)).saleId))!;
    expect(linkedSale.sale.customerId).toBe(unique.id);

    const ambiguous = await place([['Rolamentos', 1]], { buyer: { name: 'Outro', phone: '(81) 96666-0002', email: null } }, { notify: false });
    expect((await getSaleDetail((await orderRow(ambiguous.id)).saleId))!.sale.customerId).toBeNull();

    const stranger = await place([['Rolamentos', 1]], { buyer: { name: 'Desconhecido', phone: '(81) 96666-9999', email: null } }, { notify: false });
    expect((await getSaleDetail((await orderRow(stranger.id)).saleId))!.sale.customerId).toBeNull();
  });
});

describe('atendimento do pedido', () => {
  it('confirmar → pronto → concluir: exige a forma de pagamento quando há saldo e registra a entrada no financeiro', async () => {
    const placed = await place([['Rolamentos', 2]]);
    const confirmed = await changeStoreOrderStatus(placed.id, 'CONFIRMED', actor);
    expect(confirmed.status).toBe('CONFIRMED');
    expect(confirmed.confirmedAt).toBeInstanceOf(Date);
    await changeStoreOrderStatus(placed.id, 'READY', actor);

    await expect(changeStoreOrderStatus(placed.id, 'COMPLETED', actor)).rejects.toThrow(/forma de pagamento/);
    await expect(changeStoreOrderStatus(placed.id, 'CONFIRMED', actor)).rejects.toThrow(/não pode ir para/);
    await expect(changeStoreOrderStatus(placed.id, 'OUT_FOR_DELIVERY', actor)).rejects.toThrow(/não pode ir para/);
    await expect(changeStoreOrderStatus(placed.id, 'CANCELED', actor)).rejects.toThrow(/Cancelar pedido/);

    const done = await changeStoreOrderStatus(placed.id, 'COMPLETED', actor, { paymentMethod: 'DINHEIRO' });
    expect(done.status).toBe('COMPLETED');
    expect(done.completedAt).toBeInstanceOf(Date);

    const bundle = (await getStoreOrderDetail(placed.id))!;
    expect(bundle.paidCents).toBe(10000);
    expect(bundle.balanceCents).toBe(0);
    expect(bundle.payments).toHaveLength(1);
    expect(bundle.payments[0]).toMatchObject({ amountCents: 10000, method: 'DINHEIRO', paidDate: today, status: 'PAID' });
    const [payment] = await getDb().select().from(payments).where(eq(payments.saleId, bundle.sale.id));
    expect(payment).toMatchObject({ description: `Pedido online LJ-${String(placed.number).padStart(6, '0')}`, isDemo: false, createdBy: actor.id });
    expect(bundle.events.map((e) => [e.type, e.toStatus])).toEqual([
      ['CREATED', 'RECEIVED'],
      ['STATUS', 'CONFIRMED'],
      ['STATUS', 'READY'],
      ['PAYMENT', null],
      ['STATUS', 'COMPLETED'],
    ]);
    expect(bundle.events.every((e) => e.isPublic)).toBe(true);
    await expect(changeStoreOrderStatus(placed.id, 'COMPLETED', actor, { paymentMethod: 'PIX' })).rejects.toThrow(/não pode ir para/);
    await expect(cancelStoreOrder(placed.id, null, actor)).rejects.toThrow(/Pedido concluído/);
  });

  it('entrega passa por "saiu para entrega"; retirada não', async () => {
    await updateStoreSettings({ ...REAL_PIX, deliveryEnabled: true, deliveryFeeCents: 1000 }, actor);
    const address = { zip: '54000-000', street: 'Rua A', number: '1', complement: null, district: 'Centro', city: 'Recife', state: 'PE' };
    const delivery = await place([['Rolamentos', 1]], { fulfillment: 'DELIVERY', address });
    await changeStoreOrderStatus(delivery.id, 'CONFIRMED', actor);
    await changeStoreOrderStatus(delivery.id, 'READY', actor);
    await changeStoreOrderStatus(delivery.id, 'OUT_FOR_DELIVERY', actor);
    const done = await changeStoreOrderStatus(delivery.id, 'COMPLETED', actor, { paymentMethod: 'PIX' });
    expect(done.status).toBe('COMPLETED');
    expect((await getStoreOrderDetail(delivery.id))!.paidCents).toBe(6000);

    const pickup = await place([['Rolamentos', 1]]);
    await expect(changeStoreOrderStatus(pickup.id, 'OUT_FOR_DELIVERY', actor)).rejects.toThrow(/não pode ir para/);
    await updateStoreSettings(REAL_PIX, actor);
  });

  it('confirmar o PIX registra a entrada pelo saldo, confirma o pedido e não pode ser repetido', async () => {
    const placed = await place([['Rolamentos', 1], ['Capacitor permanente', 1]], { paymentMethod: 'PIX' });
    const confirmed = await confirmStorePayment(placed.id, actor);
    expect(confirmed.status).toBe('CONFIRMED');
    const bundle = (await getStoreOrderDetail(placed.id))!;
    expect(bundle.paidCents).toBe(8000);
    expect(bundle.payments[0]).toMatchObject({ method: 'PIX', amountCents: 8000 });
    expect(bundle.events.map((e) => e.type)).toEqual(['CREATED', 'PAYMENT', 'STATUS']);
    await expect(confirmStorePayment(placed.id, actor)).rejects.toThrow(/totalmente pago/);
    // com o pedido pago, concluir não pede forma de pagamento
    await changeStoreOrderStatus(placed.id, 'READY', actor);
    const done = await changeStoreOrderStatus(placed.id, 'COMPLETED', actor);
    expect(done.status).toBe('COMPLETED');
    expect((await getStoreOrderDetail(placed.id))!.payments).toHaveLength(1);
  });

  it('cancelar devolve o estoque, cancela a venda, estorna pagamentos e avisa o cliente', async () => {
    const stockBefore = await stockOf(ids['Rolamentos']!);
    const placed = await place([['Rolamentos', 5]], { paymentMethod: 'PIX' });
    expect(await stockOf(ids['Rolamentos']!)).toBe(stockBefore - 5);
    await confirmStorePayment(placed.id, actor);

    await cancelStoreOrder(placed.id, 'Cliente desistiu', actor);
    expect(await stockOf(ids['Rolamentos']!)).toBe(stockBefore);
    const bundle = (await getStoreOrderDetail(placed.id))!;
    expect(bundle.order).toMatchObject({ status: 'CANCELED', cancelReason: 'Cliente desistiu' });
    expect(bundle.order.canceledAt).toBeInstanceOf(Date);
    expect(bundle.sale.status).toBe('CANCELED');
    expect(bundle.payments.every((p) => p.status === 'VOIDED')).toBe(true);
    expect(bundle.paidCents).toBe(0);
    expect(bundle.events.at(-1)).toMatchObject({ type: 'STATUS', toStatus: 'CANCELED', isPublic: true, message: 'Pedido cancelado.' });
    await expect(cancelStoreOrder(placed.id, null, actor)).rejects.toThrow(/já foi cancelado/);
    await expect(changeStoreOrderStatus(placed.id, 'CONFIRMED', actor)).rejects.toThrow(/não pode ir para/);
    await expect(confirmStorePayment(placed.id, actor)).rejects.toThrow(/cancelado/);
  });

  it('cancelar a venda pela tela de Vendas também cancela o pedido da loja', async () => {
    const stockBefore = await stockOf(ids['Rolamentos']!);
    const placed = await place([['Rolamentos', 1]]);
    const order = await orderRow(placed.id);
    await cancelSale(order.saleId, 'Erro de lançamento', actor);
    expect(await stockOf(ids['Rolamentos']!)).toBe(stockBefore);
    expect((await orderRow(placed.id)).status).toBe('CANCELED');
    const events = await getDb().select().from(storeOrderEvents).where(eq(storeOrderEvents.orderId, placed.id));
    expect(events.at(-1)).toMatchObject({ toStatus: 'CANCELED' });
  });

  it('observações: internas ficam só para a equipe; públicas aparecem no acompanhamento', async () => {
    const placed = await place([['Rolamentos', 1]]);
    await addStoreOrderNote(placed.id, 'Cliente pediu para separar até 17h', false, actor);
    await addStoreOrderNote(placed.id, 'Previsão de retirada: amanhã às 9h', true, actor);
    const bundle = (await getStoreOrderDetail(placed.id))!;
    const notes = bundle.events.filter((e) => e.type === 'NOTE');
    expect(notes.map((n) => [n.message, n.isPublic, n.userName])).toEqual([
      ['Cliente pediu para separar até 17h', false, actor.name],
      ['Previsão de retirada: amanhã às 9h', true, actor.name],
    ]);
    await expect(addStoreOrderNote(999999, 'x', true, actor)).rejects.toThrow(/Pedido não encontrado/);
  });
});

describe('expiração de pedidos com PIX não pago', () => {
  const ago = (hours: number) => new Date(Date.now() - hours * 3_600_000);

  it('cancela sozinho pedidos com PIX vencido e devolve o estoque; preserva pagos, de retirada e de demonstração', async () => {
    const stockBefore = await stockOf(ids['Rolamentos']!);
    const stale = await place([['Rolamentos', 2]], { paymentMethod: 'PIX' }, { notify: false });
    const paid = await place([['Rolamentos', 1]], { paymentMethod: 'PIX' }, { notify: false });
    await confirmStorePayment(paid.id, actor);
    await getDb().update(storeOrders).set({ status: 'RECEIVED' }).where(eq(storeOrders.id, paid.id)); // pago, mas ainda "recebido"
    const onSite = await place([['Rolamentos', 1]], { paymentMethod: 'ON_SITE' }, { notify: false });
    const onSiteAbandoned = await place([['Rolamentos', 1]], { paymentMethod: 'ON_SITE' }, { notify: false });
    const confirmedOld = await place([['Rolamentos', 1]], { paymentMethod: 'ON_SITE' }, { notify: false });
    await changeStoreOrderStatus(confirmedOld.id, 'CONFIRMED', actor);
    const demo = await place([['Ventoinha', 1]], { paymentMethod: 'PIX' }, { notify: false });
    const fresh = await place([['Rolamentos', 1]], { paymentMethod: 'PIX' }, { notify: false });
    for (const p of [stale, paid, onSite, demo]) await getDb().update(storeOrders).set({ createdAt: ago(30) }).where(eq(storeOrders.id, p.id));
    // "pagar na retirada" só expira depois de 3× o prazo (72 h) e apenas se a equipe nunca confirmou
    for (const p of [onSiteAbandoned, confirmedOld]) await getDb().update(storeOrders).set({ createdAt: ago(80) }).where(eq(storeOrders.id, p.id));

    const canceled = await expireStaleStoreOrders({ force: true });
    expect(canceled).toBe(2);
    expect((await orderRow(onSiteAbandoned.id)).status).toBe('CANCELED');
    expect((await orderRow(onSiteAbandoned.id)).cancelReason).toMatch(/não confirmado pela loja em 72 h/);
    expect((await orderRow(confirmedOld.id)).status).toBe('CONFIRMED');
    expect((await orderRow(stale.id)).status).toBe('CANCELED');
    expect((await orderRow(stale.id)).cancelReason).toMatch(/Pagamento PIX não confirmado em 24 h/);
    expect((await orderRow(paid.id)).status).toBe('RECEIVED');
    expect((await orderRow(onSite.id)).status).toBe('RECEIVED');
    expect((await orderRow(demo.id)).status).toBe('RECEIVED');
    expect((await orderRow(fresh.id)).status).toBe('RECEIVED');
    // o estoque do pedido vencido voltou (os demais continuam reservados)
    expect(await stockOf(ids['Rolamentos']!)).toBe(stockBefore - 1 - 1 - 1 - 1);
    expect(await expireStaleStoreOrders({ force: true })).toBe(0);
  });

  it('prazo 0 desativa a expiração', async () => {
    await updateStoreSettings({ ...REAL_PIX, holdHours: 0 }, actor);
    const placed = await place([['Rolamentos', 1]], { paymentMethod: 'PIX' }, { notify: false });
    await getDb().update(storeOrders).set({ createdAt: ago(500) }).where(eq(storeOrders.id, placed.id));
    expect(await expireStaleStoreOrders({ force: true })).toBe(0);
    expect((await orderRow(placed.id)).status).toBe('RECEIVED');
    await updateStoreSettings(REAL_PIX, actor);
  });
});

describe('consultas do painel e do acompanhamento', () => {
  it('acompanhamento público só abre com o token exato (43 caracteres)', async () => {
    const placed = await place([['Rolamentos', 1]], {}, { notify: false });
    const found = await getStoreOrderByToken(placed.token);
    expect(found?.order.id).toBe(placed.id);
    expect(await getStoreOrderByToken(placed.token.slice(0, -1) + (placed.token.endsWith('A') ? 'B' : 'A'))).toBeNull();
    expect(await getStoreOrderByToken('curto')).toBeNull();
    expect(await getStoreOrderByToken("' OR 1=1 --")).toBeNull();
    expect(await getStoreOrderByToken('A'.repeat(43))).toBeNull();
  });

  it('lista com filtros por situação, "abertos", "aguardando PIX" e busca por código, nome e telefone', async () => {
    const all = await listStoreOrders({ pageSize: 200 });
    expect(all.total).toBeGreaterThan(20);
    const open = await listStoreOrders({ filter: 'ABERTOS', pageSize: 200 });
    expect(open.rows.every((r) => r.status !== 'COMPLETED' && r.status !== 'CANCELED')).toBe(true);
    const awaiting = await listStoreOrders({ filter: 'PAGAMENTO', pageSize: 200 });
    expect(awaiting.rows.length).toBeGreaterThan(0);
    expect(awaiting.rows.every((r) => r.paymentMethod === 'PIX' && r.paidCents < r.totalCents)).toBe(true);
    const canceled = await listStoreOrders({ filter: 'CANCELED', pageSize: 200 });
    expect(canceled.rows.every((r) => r.status === 'CANCELED')).toBe(true);

    const first = all.rows.at(-1)!;
    expect((await listStoreOrders({ q: 'LJ-000001' })).rows.map((r) => r.number)).toEqual([1]);
    expect((await listStoreOrders({ q: `lj${first.number}` })).rows.map((r) => r.number)).toEqual([first.number]);
    expect((await listStoreOrders({ q: 'fulano repetido' })).total).toBe(3);
    expect((await listStoreOrders({ q: '977770001' })).total).toBe(3);
    expect((await listStoreOrders({ q: 'nao-existe-xyz' })).total).toBe(0);

    const page1 = await listStoreOrders({ pageSize: 5, page: 1 });
    const page2 = await listStoreOrders({ pageSize: 5, page: 2 });
    expect(page1.rows).toHaveLength(5);
    expect(page1.rows.map((r) => r.id)).not.toEqual(page2.rows.map((r) => r.id));
    expect(page1.rows[0]!.createdAt.getTime()).toBeGreaterThanOrEqual(page1.rows[4]!.createdAt.getTime());
  });

  it('resumo, contagem de novos pedidos e alerta calculado para quem pode ver a loja', async () => {
    const summary = await storeOrdersSummary(Date.now() - 86_400_000);
    expect(summary.received).toBeGreaterThan(0);
    expect(summary.awaitingPayment).toBeGreaterThan(0);
    expect(summary.ordersMonth).toBeGreaterThan(0);
    expect(summary.soldMonthCents).toBeGreaterThan(0);
    expect(await countNewStoreOrders()).toBe(summary.received);

    const withPermission = await getSystemAlerts({ permissions: ['store.view'] }, 'America/Recife');
    expect(withPermission.find((a) => a.key === 'store-new')).toMatchObject({ count: summary.received, link: '/sistema/loja?status=RECEIVED' });
    expect((await getSystemAlerts({ permissions: ['orders.view'] }, 'America/Recife')).find((a) => a.key === 'store-new')).toBeUndefined();
  });

  it('as vendas da loja aparecem em Vendas com o canal e podem ser filtradas', async () => {
    const online = await listSales({ channel: 'LOJA', pageSize: 200 });
    expect(online.total).toBeGreaterThan(20);
    expect(online.rows.every((r) => r.channel === 'LOJA' && r.storeOrderId !== null)).toBe(true);
    const counter = await listSales({ channel: 'BALCAO', pageSize: 200 });
    expect(counter.rows.every((r) => r.channel === 'BALCAO')).toBe(true);
  });
});

describe('busca global e documentos', () => {
  it('LJ-000001 abre o pedido direto; quem não vê a loja não encontra pedidos', async () => {
    const found = await globalSearch('LJ-000001', { permissions: ['store.view'] });
    expect(found.direct).toMatchObject({ type: 'store', title: expect.stringContaining('LJ-000001') });
    expect(found.direct!.href.startsWith('/sistema/loja/')).toBe(true);
    expect(found.groups.some((g) => g.label === 'Loja online')).toBe(true);
    const byName = await globalSearch('lj fulano repetido', { permissions: ['store.view'] });
    expect(byName.groups.find((g) => g.label === 'Loja online')?.items.length).toBeGreaterThan(0);
    const denied = await globalSearch('LJ-000001', { permissions: ['orders.view'] });
    expect(denied.groups.some((g) => g.label === 'Loja online')).toBe(false);
    expect(denied.direct).toBeNull();
  });

  it('comprovante e recibo de uma venda da loja saem no nome de quem comprou (com o endereço de entrega, se houver)', async () => {
    await updateStoreSettings({ ...REAL_PIX, deliveryEnabled: true, deliveryFeeCents: 500 }, actor);
    const address = { zip: '54000-000', street: 'Rua das Flores', number: '10', complement: 'Casa', district: 'Centro', city: 'Recife', state: 'PE' };
    const placed = await place([['Rolamentos', 1]], { fulfillment: 'DELIVERY', address, buyer: { name: 'Beatriz Compradora', phone: '(81) 95555-1234', email: null } }, { notify: false });
    await updateStoreSettings(REAL_PIX, actor);
    const order = await orderRow(placed.id);

    const doc = await buildSaleDocument(order.saleId);
    expect(doc.customer.name).toBe('Beatriz Compradora');
    expect(doc.customer.contact).toBe('(81) 95555-1234');
    expect(doc.customer.address).toBe('Rua das Flores, 10 - Casa - Centro - Recife/PE - CEP 54000-000');
    expect(doc.items.map((i) => i.description)).toEqual(['Rolamentos', 'Taxa de entrega']);
    expect(doc.totals.totalCents).toBe(5500);

    await changeStoreOrderStatus(placed.id, 'CONFIRMED', actor);
    await changeStoreOrderStatus(placed.id, 'READY', actor);
    await changeStoreOrderStatus(placed.id, 'OUT_FOR_DELIVERY', actor);
    await changeStoreOrderStatus(placed.id, 'COMPLETED', actor, { paymentMethod: 'PIX' });
    const [payment] = await getDb().select().from(payments).where(eq(payments.saleId, order.saleId));
    const receipt = await buildReceiptDocument(payment!.id);
    expect(receipt.payer.name).toBe('Beatriz Compradora');
    expect(receipt.reference).toContain('venda de produtos');
  });
});

describe('impressão do pedido (folha A4 e PDF)', () => {
  it('o documento do pedido traz o que a equipe precisa: código, como receber, pagamento, situação e observações do cliente', async () => {
    const placed = await place([['Rolamentos', 2]], { paymentMethod: 'PIX', notes: 'Retiro às 15h', buyer: { name: 'Bianca Retirada', phone: '(81) 94444-7777', email: 'bianca@exemplo.com' } }, { notify: false });
    const order = await orderRow(placed.id);
    const sale = await getSaleDetail(order.saleId);

    const doc = await buildSaleDocument(order.saleId);
    expect(doc.title).toBe('PEDIDO DA LOJA ONLINE');
    expect(doc.code).toBe(formatStoreOrderCode(order.number));
    expect(doc.demo).toBe(false);
    expect(doc.canceled).toBe(false);
    expect(doc.order).toEqual({
      code: formatStoreOrderCode(order.number),
      saleCode: formatSaleCode(sale!.sale.number),
      placedAt: expect.stringMatching(/^\d{2}\/\d{2}\/\d{4} \d{2}:\d{2}$/),
      fulfillment: 'Retirada na loja',
      isDelivery: false,
      deliveryAddress: '',
      payment: 'PIX — aguardando confirmação do pagamento',
      status: 'Recebido',
      email: 'bianca@exemplo.com',
      buyerNotes: 'Retiro às 15h',
    });
    expect(doc.customer).toMatchObject({ name: 'Bianca Retirada', contact: '(81) 94444-7777' });

    // Pagamento confirmado: o papel passa a dizer "pago" e a situação avança.
    await confirmStorePayment(placed.id, actor);
    const paid = await buildSaleDocument(order.saleId);
    expect(paid.order).toMatchObject({ payment: 'PIX — pago', status: 'Confirmado' });
    expect(paid.totals.balanceCents).toBe(0);

    // Cancelado: sai marcado.
    await cancelStoreOrder(placed.id, 'Cliente desistiu', actor);
    const canceled = await buildSaleDocument(order.saleId);
    expect(canceled.canceled).toBe(true);
    expect(canceled.order).toMatchObject({ status: 'Cancelado' });
  });

  it('pagar na retirada/entrega aparece como "a receber" e a entrega mostra o endereço completo com CEP', async () => {
    await updateStoreSettings({ ...REAL_PIX, deliveryEnabled: true, deliveryFeeCents: 800 }, actor);
    const address = { zip: '50123456', street: 'Av. Central', number: '200', complement: null, district: 'Boa Viagem', city: 'Recife', state: 'PE' };
    const placed = await place([['Rolamentos', 1]], { fulfillment: 'DELIVERY', address, paymentMethod: 'ON_SITE' }, { notify: false });
    await updateStoreSettings(REAL_PIX, actor);

    const doc = await buildSaleDocument((await orderRow(placed.id)).saleId);
    expect(doc.order).toMatchObject({
      fulfillment: 'Entrega',
      isDelivery: true,
      deliveryAddress: 'Av. Central, 200 - Boa Viagem - Recife/PE - CEP 50123-456',
      payment: 'Pagar na entrega — a receber',
      email: '',
      buyerNotes: '',
    });
    expect(doc.customer.address).toBe('Av. Central, 200 - Boa Viagem - Recife/PE - CEP 50123-456');
    expect(doc.items.map((item) => item.description)).toEqual(['Rolamentos', 'Taxa de entrega']);
  });

  it('venda de balcão continua sendo "comprovante de venda", sem bloco de pedido; registro de demonstração sai marcado', async () => {
    const counter = await createSale({ customerId: null, saleDate: today, discountCents: 0, notes: null, items: [{ productId: ids['Rolamentos']!, description: 'Rolamentos', quantity: 1, unitPriceCents: 5000 }] }, actor);
    const doc = await buildSaleDocument(counter.id);
    expect(doc).toMatchObject({ title: 'COMPROVANTE DE VENDA', code: formatSaleCode(counter.number), order: null, demo: false });

    const [demoOrder] = await getDb().select({ saleId: storeOrders.saleId }).from(storeOrders).where(eq(storeOrders.isDemo, true)).limit(1);
    expect(demoOrder).toBeDefined();
    const demoDoc = await buildSaleDocument(demoOrder!.saleId);
    expect(demoDoc.demo).toBe(true);
    expect(demoDoc.order).not.toBeNull();
  });

  it('a folha A4 e o PDF do pedido usam o mesmo modelo (bloco do pedido, endereço de entrega e observações)', async () => {
    await updateStoreSettings({ ...REAL_PIX, deliveryEnabled: true, deliveryFeeCents: 0 }, actor);
    const address = { zip: '51020000', street: 'Rua do Sol', number: '5', complement: 'Apto 2', district: 'Pina', city: 'Recife', state: 'PE' };
    const placed = await place([['Rolamentos', 1]], { fulfillment: 'DELIVERY', address, notes: 'Deixar com o porteiro' }, { notify: false });
    await updateStoreSettings(REAL_PIX, actor);
    const doc = await buildSaleDocument((await orderRow(placed.id)).saleId);

    const html = renderToStaticMarkup(createElement(SaleSheet, { doc }));
    expect(html).toContain('PEDIDO DA LOJA ONLINE');
    expect(html).toContain('Pedido da loja online');
    expect(html).toContain(doc.order!.code);
    expect(html).toContain('Endereço de entrega');
    expect(html).toContain('Rua do Sol, 5 - Apto 2 - Pina - Recife/PE - CEP 51020-000');
    expect(html.split('Rua do Sol, 5').length - 1).toBe(1); // o endereço aparece só no bloco do pedido, não repetido em "Cliente"
    expect(html).toContain('Deixar com o porteiro');
    expect(html).not.toContain('DEMONSTRAÇÃO');

    const pdf = await renderSalePdf(doc, null);
    expect(pdf.subarray(0, 5).toString()).toBe('%PDF-');
    expect(pdf.length).toBeGreaterThan(2000);
  });

  it('a folha de um pedido de demonstração ou cancelado traz o aviso em destaque', async () => {
    const [demoOrder] = await getDb().select({ saleId: storeOrders.saleId }).from(storeOrders).where(eq(storeOrders.isDemo, true)).limit(1);
    const html = renderToStaticMarkup(createElement(SaleSheet, { doc: await buildSaleDocument(demoOrder!.saleId) }));
    expect(html).toContain('DEMONSTRAÇÃO');

    const placed = await place([['Rolamentos', 1]], {}, { notify: false });
    await cancelStoreOrder(placed.id, null, actor);
    const canceledHtml = renderToStaticMarkup(createElement(SaleSheet, { doc: await buildSaleDocument((await orderRow(placed.id)).saleId) }));
    expect(canceledHtml).toContain('PEDIDO CANCELADO');
  });
});

describe('impressão automática: pedidos novos', () => {
  it('lista os pedidos criados depois do ponteiro, do mais antigo para o mais novo, com o código LJ', async () => {
    const start = await latestStoreOrderId();
    const first = await place([['Rolamentos', 1]], {}, { notify: false });
    const second = await place([['Rolamentos', 1]], {}, { notify: false });

    const { upTo, orders } = await listStoreOrdersToPrint(start);
    expect(orders.map((order) => order.id)).toEqual([first.id, second.id]);
    expect(orders.map((order) => order.code)).toEqual([formatStoreOrderCode(first.number), formatStoreOrderCode(second.number)]);
    expect(orders[0]!.saleId).toBe((await orderRow(first.id)).saleId);
    expect(upTo).toBe(second.id);

    // Sem novidades, o ponteiro não anda.
    expect(await listStoreOrdersToPrint(upTo)).toEqual({ upTo, orders: [] });
    expect(await latestStoreOrderId()).toBe(second.id);
  });

  it('respeita o limite por consulta e continua de onde parou', async () => {
    const start = await latestStoreOrderId();
    const placed = [];
    for (let i = 0; i < 3; i++) placed.push(await place([['Rolamentos', 1]], {}, { notify: false }));

    const page1 = await listStoreOrdersToPrint(start, 2);
    expect(page1.orders.map((order) => order.id)).toEqual([placed[0]!.id, placed[1]!.id]);
    expect(page1.upTo).toBe(placed[1]!.id);
    const page2 = await listStoreOrdersToPrint(page1.upTo, 2);
    expect(page2.orders.map((order) => order.id)).toEqual([placed[2]!.id]);
    expect(page2.upTo).toBe(placed[2]!.id);
  });

  it('pedido cancelado não é impresso, mas o ponteiro passa por ele (não é examinado de novo)', async () => {
    const start = await latestStoreOrderId();
    const kept = await place([['Rolamentos', 1]], {}, { notify: false });
    const dropped = await place([['Rolamentos', 1]], {}, { notify: false });
    await cancelStoreOrder(dropped.id, 'Duplicado', actor);

    const result = await listStoreOrdersToPrint(start);
    expect(result.orders.map((order) => order.id)).toEqual([kept.id]);
    expect(result.upTo).toBe(dropped.id);
  });

  it('"imprimir o último pedido" (teste da impressora) devolve o mais recente que não foi cancelado', async () => {
    const kept = await place([['Rolamentos', 1]], {}, { notify: false });
    const dropped = await place([['Rolamentos', 1]], {}, { notify: false });
    await cancelStoreOrder(dropped.id, null, actor);
    expect(await latestStoreOrderToPrint()).toEqual({ id: kept.id, saleId: (await orderRow(kept.id)).saleId, code: formatStoreOrderCode(kept.number) });
  });
});

describe('configurações e limpeza da demonstração', () => {
  it('configurações: sem linha usa os padrões; salvar cria/atualiza e guarda o que foi informado', async () => {
    await runWrite((tx) => tx.run(sql`DELETE FROM store_settings`));
    expect(await getStoreSettings()).toEqual(STORE_DEFAULTS);
    const config = { ...REAL_PIX, deliveryEnabled: true, deliveryFeeCents: 1200, freeDeliveryMinCents: 30000, deliveryNote: 'Só em Jaboatão', pickupNote: 'Balcão da loja', minOrderCents: 500, holdHours: 12, policyText: 'Trocas em até 7 dias.' };
    await updateStoreSettings(config, actor);
    expect(await getStoreSettings()).toEqual(config);
    await updateStoreSettings(REAL_PIX, actor);
    expect(await getStoreSettings()).toEqual(REAL_PIX);
  });

  it('remover a demonstração apaga pedidos e preços fictícios e mantém os pedidos reais e o estoque', async () => {
    expect(await hasDemoData()).toBe(true);
    const before = await countDemoData();
    expect(before.storeOrders).toBeGreaterThan(0);
    expect(before.demoPrices).toBeGreaterThan(0);
    const realBefore = await getDb().select().from(storeOrders).where(eq(storeOrders.isDemo, false));
    const stockBefore = await stockOf(ids['Rolamentos']!);

    const removed = await clearDemoData();
    expect(removed.storeOrders).toBe(before.storeOrders);
    expect(await hasDemoData()).toBe(false);
    expect(await storeHasDemoPrices()).toBe(false);
    expect((await getDb().select().from(storeOrders).where(eq(storeOrders.isDemo, true)))).toHaveLength(0);
    expect((await getDb().select().from(storeOrders).where(eq(storeOrders.isDemo, false)))).toHaveLength(realBefore.length);
    expect(await stockOf(ids['Rolamentos']!)).toBe(stockBefore);
    const orphanEvents = await getDb().all<{ n: number }>(sql`SELECT COUNT(*) AS n FROM store_order_events e LEFT JOIN store_orders o ON o.id = e.order_id WHERE o.id IS NULL`);
    expect(Number(orphanEvents[0]!.n)).toBe(0);

    // sem preço real e sem preço de demonstração, o produto volta a "consultar valor"
    const ventoinha = (await listStoreProducts()).products.find((p) => p.name === 'Ventoinha')!;
    expect(ventoinha).toMatchObject({ priceCents: null, purchasable: false, state: 'CONSULT' });
    // preços reais continuam
    expect((await listStoreProducts()).products.find((p) => p.name === 'Rolamentos')).toMatchObject({ priceCents: 5000, purchasable: true });
  });
});

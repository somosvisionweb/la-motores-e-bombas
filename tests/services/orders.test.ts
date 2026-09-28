import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { eq } from 'drizzle-orm';
import { getDb } from '@/server/db/client';
import { guaranteeTerms, notifications, products, serviceOrders, stockMovements } from '@/server/db/schema';
import { BusinessError } from '@/server/auth/errors';
import type { Actor } from '@/server/auth/types';
import { createCustomer, getCustomerDetail, deleteCustomer } from '@/server/services/customers';
import { adjustStock } from '@/server/services/products';
import { addOrderNote, changeOrderStatus, createOrder, deleteOrder, getOrderDetail, listOrders, updateOrder, type OrderInput } from '@/server/services/orders';
import { listPayments, registerPayment, voidPayment } from '@/server/services/payments';
import { setupTestDb, teardownTestDb } from '../helpers/db';

let actor: Actor;
let customerId: number;
let bearingId: number;

const today = new Date().toISOString().slice(0, 10);

function baseOrder(overrides: Partial<OrderInput> = {}): OrderInput {
  return {
    customerId,
    equipment: 'Motor elétrico 1/2 cv',
    brand: 'WEG',
    model: null,
    problemDescription: 'Não parte',
    diagnosis: null,
    serviceDescription: 'Rebobinamento completo',
    entryDate: today,
    expectedDeliveryDate: null,
    nextServiceDate: null,
    technicianId: null,
    paymentMethod: 'PIX',
    discountCents: 1000,
    notes: null,
    items: [
      { kind: 'SERVICE', description: 'Rebobinamento de motores elétricos', quantity: 1, unitPriceCents: 18000 },
      { kind: 'PART', productId: bearingId, description: 'Rolamentos', quantity: 2, unitPriceCents: 3500 },
    ],
    ...overrides,
  };
}

async function stockOf(productId: number): Promise<number> {
  const [row] = await getDb().select({ stock: products.stock }).from(products).where(eq(products.id, productId));
  return row!.stock;
}

beforeAll(async () => {
  ({ actor } = await setupTestDb('orders'));
  const customer = await createCustomer(
    { name: 'Cliente de Teste', phone: '(81) 90000-0001', whatsapp: null, document: null, email: null, address: 'Rua X, 1', notes: null },
    actor,
    { isDemo: true },
  );
  customerId = customer.id;
  const [bearing] = await getDb().select().from(products).where(eq(products.name, 'Rolamentos'));
  bearingId = bearing!.id;
  await adjustStock(bearingId, { mode: 'ADD', quantity: 10, note: 'teste' }, actor);
});

afterAll(() => teardownTestDb());

describe('ordem de serviço + estoque + pagamentos', () => {
  let orderId: number;

  it('cria a OS, calcula totais e baixa o estoque das peças', async () => {
    const order = await createOrder(baseOrder({ items: baseOrder().items.map((i) => (i.kind === 'PART' ? { ...i, productId: bearingId } : i)) }), actor);
    orderId = order.id;
    expect(order.number).toBe(1);
    expect(order.status).toBe('AGUARDANDO_AVALIACAO');
    expect(order.laborTotalCents).toBe(18000);
    expect(order.partsTotalCents).toBe(7000);
    expect(order.discountCents).toBe(1000);
    expect(order.totalCents).toBe(24000);
    expect(await stockOf(bearingId)).toBe(8);
  });

  it('numeração é sequencial', async () => {
    const second = await createOrder(baseOrder({ items: [{ kind: 'SERVICE', description: 'Manutenção em geral', quantity: 1, unitPriceCents: 5000 }], discountCents: 0 }), actor);
    expect(second.number).toBe(2);
    await deleteOrder(second.id, actor);
  });

  it('editar as peças reconcilia o estoque (idempotente)', async () => {
    await updateOrder(orderId, baseOrder({ items: [{ kind: 'PART', productId: bearingId, description: 'Rolamentos', quantity: 5, unitPriceCents: 3500 }], discountCents: 0 }), actor);
    expect(await stockOf(bearingId)).toBe(5);
    await updateOrder(orderId, baseOrder({ items: [{ kind: 'PART', productId: bearingId, description: 'Rolamentos', quantity: 5, unitPriceCents: 3500 }], discountCents: 0 }), actor);
    expect(await stockOf(bearingId)).toBe(5);
    await updateOrder(orderId, baseOrder({ items: [{ kind: 'SERVICE', description: 'Rebobinamento', quantity: 1, unitPriceCents: 18000 }], discountCents: 1000 }), actor);
    expect(await stockOf(bearingId)).toBe(10);
    // volta ao conjunto original para os próximos testes
    await updateOrder(orderId, baseOrder(), actor);
    expect(await stockOf(bearingId)).toBe(8);
  });

  it('fluxo de status: datas, notificações e termos de garantia', async () => {
    await changeOrderStatus(orderId, 'AGUARDANDO_APROVACAO', actor, { note: 'Orçamento passado por telefone' });
    const notes = await getDb().select().from(notifications);
    expect(notes.some((n) => n.type === 'ORDER_AWAITING_APPROVAL')).toBe(true);
    expect(notes.some((n) => n.type === 'ORDER_CREATED')).toBe(true);

    await changeOrderStatus(orderId, 'PRONTO', actor);
    let detail = (await getOrderDetail(orderId))!;
    expect(detail.order.completedDate).toBe(today);
    expect(detail.order.deliveredDate).toBeNull();
    expect((await getDb().select().from(notifications)).some((n) => n.type === 'ORDER_READY')).toBe(true);

    await changeOrderStatus(orderId, 'ENTREGUE', actor);
    detail = (await getOrderDetail(orderId))!;
    expect(detail.order.deliveredDate).toBe(today);
    expect(detail.terms?.warrantyMonths).toBe(3);

    await changeOrderStatus(orderId, 'EM_MANUTENCAO', actor);
    detail = (await getOrderDetail(orderId))!;
    expect(detail.order.completedDate).toBeNull();
    expect(detail.order.deliveredDate).toBeNull();
    expect(detail.events.filter((e) => e.type === 'STATUS').length).toBeGreaterThanOrEqual(4);
  });

  it('mesmo status é recusado', async () => {
    await expect(changeOrderStatus(orderId, 'EM_MANUTENCAO', actor)).rejects.toBeInstanceOf(BusinessError);
  });

  it('pagamentos parciais, excesso bloqueado e saldo', async () => {
    const first = await registerPayment({ orderId, amountCents: 10000, method: 'PIX', paidDate: today }, actor, { isDemo: true });
    expect(first.customerId).toBe(customerId);
    await expect(registerPayment({ orderId, amountCents: 20000, method: 'DINHEIRO', paidDate: today }, actor)).rejects.toThrow(/excede o saldo/);
    await registerPayment({ orderId, amountCents: 14000, method: 'DINHEIRO', paidDate: today }, actor, { isDemo: true });
    const detail = (await getOrderDetail(orderId))!;
    expect(detail.paidCents).toBe(24000);
    expect(detail.balanceCents).toBe(0);
    await expect(registerPayment({ orderId, amountCents: 100, method: 'PIX', paidDate: today }, actor)).rejects.toThrow(/totalmente paga/);
  });

  it('não permite reduzir o total abaixo do já recebido', async () => {
    await expect(updateOrder(orderId, baseOrder({ discountCents: 0, items: [{ kind: 'SERVICE', description: 'x', quantity: 1, unitPriceCents: 100 }] }), actor)).rejects.toThrow(/menor que o já recebido/);
  });

  it('cancelar com pagamentos é bloqueado; após estorno, cancela e devolve o estoque', async () => {
    await expect(changeOrderStatus(orderId, 'CANCELADO', actor)).rejects.toThrow(/Estorne os pagamentos/);
    const { rows } = await listPayments({ orderId });
    for (const payment of rows) await voidPayment(payment.id, 'Erro de lançamento', actor);
    expect((await getOrderDetail(orderId))!.paidCents).toBe(0);
    await expect(voidPayment(rows[0]!.id, 'de novo', actor)).rejects.toThrow(/já foi estornado/);

    expect(await stockOf(bearingId)).toBe(8);
    await changeOrderStatus(orderId, 'CANCELADO', actor, { note: 'Cliente desistiu' });
    expect(await stockOf(bearingId)).toBe(10);
    await expect(updateOrder(orderId, baseOrder(), actor)).rejects.toThrow(/cancelada/);

    // reabrir consome o estoque novamente
    await changeOrderStatus(orderId, 'AGUARDANDO_AVALIACAO', actor);
    expect(await stockOf(bearingId)).toBe(8);
  });

  it('excluir OS sem pagamentos devolve o estoque; com pagamentos é bloqueado', async () => {
    await registerPayment({ orderId, amountCents: 1000, method: 'PIX', paidDate: today }, actor, { isDemo: true });
    await expect(deleteOrder(orderId, actor)).rejects.toThrow(/pagamentos registrados/);
    const other = await createOrder(baseOrder(), actor);
    expect(await stockOf(bearingId)).toBe(6);
    await deleteOrder(other.id, actor);
    expect(await stockOf(bearingId)).toBe(8);
  });

  it('ordens de demonstração não movimentam o estoque', async () => {
    const demo = await createOrder(baseOrder(), actor, { isDemo: true });
    expect(await stockOf(bearingId)).toBe(8);
    await changeOrderStatus(demo.id, 'CANCELADO', actor);
    expect(await stockOf(bearingId)).toBe(8);
    const movements = await getDb().select().from(stockMovements).where(eq(stockMovements.refId, demo.id));
    expect(movements).toHaveLength(0);
  });

  it('listagem: busca por código, status e pagamento', async () => {
    const byCode = await listOrders({ q: 'OS-000001', today });
    expect(byCode.total).toBe(1);
    expect(byCode.rows[0]!.customerName).toBe('Cliente de Teste');

    const byName = await listOrders({ q: 'cliente teste', today });
    expect(byName.total).toBeGreaterThanOrEqual(1);

    const open = await listOrders({ status: 'abertas', today });
    expect(open.rows.every((r) => r.status !== 'ENTREGUE' && r.status !== 'CANCELADO')).toBe(true);

    const pending = await listOrders({ payment: 'parcial', today });
    expect(pending.rows.some((r) => r.id === orderId)).toBe(true);
    expect(pending.rows.find((r) => r.id === orderId)!.paidCents).toBe(1000);
  });

  it('histórico do cliente: cliente com ordens não pode ser excluído; último serviço só considera concluídos', async () => {
    let detail = (await getCustomerDetail(customerId))!;
    expect(detail.timeline.length).toBeGreaterThanOrEqual(2);
    expect(detail.lastService).toBeNull();
    await changeOrderStatus(orderId, 'PRONTO', actor);
    detail = (await getCustomerDetail(customerId))!;
    expect(detail.lastService?.description).toBe('Rebobinamento completo');
    expect(detail.lastService?.cents).toBe(24000);
    await expect(deleteCustomer(customerId, actor)).rejects.toThrow(/histórico/);
  });

  it('comentário interno entra na linha do tempo', async () => {
    await addOrderNote(orderId, 'Cliente avisou que busca amanhã', actor);
    const detail = (await getOrderDetail(orderId))!;
    expect(detail.events[0]!.type).toBe('NOTE');
    expect(detail.events[0]!.message).toBe('Cliente avisou que busca amanhã');
  });

  it('termos de garantia ativos: versão 1 com 3 meses', async () => {
    const terms = await getDb().select().from(guaranteeTerms).where(eq(guaranteeTerms.isActive, true));
    expect(terms).toHaveLength(1);
    expect(terms[0]!.version).toBe(1);
    const all = await getDb().select().from(serviceOrders);
    expect(all.length).toBeGreaterThan(0);
  });
});

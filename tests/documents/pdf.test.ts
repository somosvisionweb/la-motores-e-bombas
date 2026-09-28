import fs from 'node:fs';
import path from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { eq } from 'drizzle-orm';
import { getDb } from '@/server/db/client';
import { products } from '@/server/db/schema';
import type { Actor } from '@/server/auth/types';
import { createCustomer } from '@/server/services/customers';
import { changeOrderStatus, createOrder } from '@/server/services/orders';
import { registerPayment } from '@/server/services/payments';
import { adjustStock } from '@/server/services/products';
import { createSale } from '@/server/services/sales';
import { buildOrderDocument, buildReceiptDocument, buildSaleDocument, loadLogo } from '@/server/documents/model';
import { renderOrderPdf, renderReceiptPdf, renderSalePdf } from '@/server/documents/pdf/documents';
import { setupTestDb, teardownTestDb } from '../helpers/db';

let actor: Actor;
const today = new Date().toISOString().slice(0, 10);
const out = path.resolve('.tmp');

beforeAll(async () => {
  ({ actor } = await setupTestDb('pdf'));
});
afterAll(() => teardownTestDb());

describe('documentos em PDF', () => {
  it('gera OS, recibo e comprovante de venda como PDFs válidos', async () => {
    const customer = await createCustomer(
      { name: '[DEMO] Maria das Dores Albuquerque', phone: '(81) 90000-0002', whatsapp: '(81) 90000-0002', document: '52998224725', email: null, address: 'Rua das Acácias, 250 - Prazeres - Jaboatão dos Guararapes/PE', notes: null },
      actor,
      { isDemo: true },
    );
    const [bearing] = await getDb().select().from(products).where(eq(products.name, 'Rolamentos'));
    await adjustStock(bearing!.id, { mode: 'ADD', quantity: 20, note: 'teste' }, actor);

    const order = await createOrder(
      {
        customerId: customer.id,
        equipment: 'Motor elétrico trifásico 3 cv',
        brand: 'WEG',
        model: 'W22',
        problemDescription: 'Motor desarma o disjuntor ao partir.',
        diagnosis: 'Enrolamento com espiras em curto.',
        serviceDescription: 'Rebobinamento completo do estator, troca dos rolamentos e teste em bancada.',
        entryDate: today,
        expectedDeliveryDate: today,
        nextServiceDate: null,
        technicianId: actor.id,
        paymentMethod: 'PIX',
        discountCents: 2000,
        notes: 'Cliente retira na sexta-feira.',
        items: [
          { kind: 'SERVICE', description: 'Rebobinamento de motores elétricos', quantity: 1, unitPriceCents: 42000 },
          { kind: 'PART', productId: bearing!.id, description: 'Rolamentos', quantity: 2, unitPriceCents: 3800 },
        ],
      },
      actor,
      { isDemo: true },
    );
    await changeOrderStatus(order.id, 'ENTREGUE', actor);
    const payment = await registerPayment({ orderId: order.id, amountCents: 20000, method: 'PIX', paidDate: today }, actor, { isDemo: true });

    const orderDoc = await buildOrderDocument(order.id);
    expect(orderDoc.code).toBe('OS-000001');
    expect(orderDoc.terms.blocks.length).toBeGreaterThan(10);
    const orderPdf = await renderOrderPdf(orderDoc, await loadLogo(orderDoc.company));
    expect(orderPdf.subarray(0, 5).toString()).toBe('%PDF-');
    expect(orderPdf.length).toBeGreaterThan(8_000);

    const receiptDoc = await buildReceiptDocument(payment.id);
    expect(receiptDoc.amountInWords).toBe('duzentos reais');
    expect(receiptDoc.balanceAfterCents).toBe(order.totalCents - 20000);
    const receiptPdf = await renderReceiptPdf(receiptDoc, null);
    expect(receiptPdf.subarray(0, 5).toString()).toBe('%PDF-');

    const sale = await createSale(
      { customerId: null, saleDate: today, discountCents: 0, notes: null, items: [{ productId: bearing!.id, description: 'Rolamentos', quantity: 3, unitPriceCents: 3800 }], payment: { method: 'DINHEIRO' } },
      actor,
      { isDemo: true },
    );
    const saleDoc = await buildSaleDocument(sale.id);
    expect(saleDoc.totals.paidCents).toBe(11400);
    const salePdf = await renderSalePdf(saleDoc, null);
    expect(salePdf.subarray(0, 5).toString()).toBe('%PDF-');

    fs.mkdirSync(out, { recursive: true });
    fs.writeFileSync(path.join(out, 'os.pdf'), orderPdf);
    fs.writeFileSync(path.join(out, 'recibo.pdf'), receiptPdf);
    fs.writeFileSync(path.join(out, 'venda.pdf'), salePdf);
  });
});

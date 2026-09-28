import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { eq } from 'drizzle-orm';
import { addDaysISO, resolvePeriod, todayISO } from '@/lib/dates';
import type { Actor } from '@/server/auth/types';
import { getDb } from '@/server/db/client';
import { expenseCategories, payments, products, saleItems, sales } from '@/server/db/schema';
import { createCustomer } from '@/server/services/customers';
import { createExpense, deleteExpense, deleteExpenseCategory, listExpenseCategories, saveExpenseCategory, updateExpense } from '@/server/services/expenses';
import { getFinanceSummary, getIncomeByMethod } from '@/server/services/finance';
import { registerPayment, voidPayment } from '@/server/services/payments';
import { adjustStock } from '@/server/services/products';
import { buildReport, reportToCsv, REPORT_TYPES } from '@/server/services/reports';
import { cancelSale, createSale, getSaleDetail, listSales } from '@/server/services/sales';
import { setupTestDb, teardownTestDb } from '../helpers/db';

let actor: Actor;
let fanId: number;
let customerId: number;
const today = todayISO('America/Recife');

async function stockOf(id: number): Promise<number> {
  const [row] = await getDb().select({ stock: products.stock }).from(products).where(eq(products.id, id));
  return row!.stock;
}

beforeAll(async () => {
  ({ actor } = await setupTestDb('sales-finance'));
  const [fan] = await getDb().select().from(products).where(eq(products.name, 'Ventoinha'));
  fanId = fan!.id;
  await getDb().update(products).set({ costCents: 1000, salePriceCents: 2500 }).where(eq(products.id, fanId));
  await adjustStock(fanId, { mode: 'ADD', quantity: 10, note: 'estoque de teste' }, actor);
  const customer = await createCustomer(
    { name: 'Cliente Vendas', phone: '(81) 90000-0100', whatsapp: null, document: null, email: null, address: null, notes: null },
    actor,
    { isDemo: true },
  );
  customerId = customer.id;
});

afterAll(() => teardownTestDb());

describe('vendas de balcão', () => {
  let saleId: number;

  it('registra a venda, baixa o estoque, guarda o custo do momento e recebe o pagamento', async () => {
    const sale = await createSale(
      {
        customerId,
        saleDate: today,
        discountCents: 500,
        notes: null,
        items: [{ productId: fanId, description: 'Ventoinha', quantity: 2, unitPriceCents: 2500 }],
        payment: { method: 'PIX' },
      },
      actor,
    );
    saleId = sale.id;
    expect(sale.number).toBe(1);
    expect(sale.totalCents).toBe(4500);
    expect(await stockOf(fanId)).toBe(8);

    const [item] = await getDb().select().from(saleItems).where(eq(saleItems.saleId, sale.id));
    expect(item!.unitCostCents).toBe(1000);
    expect(item!.totalCents).toBe(5000);

    const detail = await getSaleDetail(sale.id);
    expect(detail!.payments).toHaveLength(1);
    expect(detail!.payments[0]!.amountCents).toBe(4500);
  });

  it('não aceita pagamento acima do saldo (venda já quitada)', async () => {
    await expect(registerPayment({ saleId, amountCents: 100, method: 'DINHEIRO', paidDate: today }, actor)).rejects.toThrow(/totalmente paga/);
  });

  it('cancelar devolve o estoque, estorna os pagamentos e não pode ser repetido', async () => {
    await cancelSale(saleId, 'Cliente desistiu', actor);
    expect(await stockOf(fanId)).toBe(10);
    const rows = await getDb().select().from(payments).where(eq(payments.saleId, saleId));
    expect(rows.every((p) => p.status === 'VOIDED')).toBe(true);
    const [row] = await getDb().select().from(sales).where(eq(sales.id, saleId));
    expect(row!.status).toBe('CANCELED');
    await expect(cancelSale(saleId, null, actor)).rejects.toThrow(/já foi cancelada/);
    await expect(registerPayment({ saleId, amountCents: 100, method: 'PIX', paidDate: today }, actor)).rejects.toThrow(/cancelada/);
  });

  it('venda com pagamento parcial e depois o restante; excesso é recusado com o saldo correto', async () => {
    const sale = await createSale({ customerId: null, saleDate: today, discountCents: 0, notes: null, items: [{ productId: fanId, description: 'Ventoinha', quantity: 1, unitPriceCents: 10000 }] }, actor);
    await registerPayment({ saleId: sale.id, amountCents: 4000, method: 'DINHEIRO', paidDate: today }, actor);
    await expect(registerPayment({ saleId: sale.id, amountCents: 6001, method: 'PIX', paidDate: today }, actor)).rejects.toThrow(/saldo a receber \(R\$\s?60,00\)/);
    await registerPayment({ saleId: sale.id, amountCents: 6000, method: 'PIX', paidDate: today }, actor);
    const detail = await getSaleDetail(sale.id);
    expect(detail!.payments.reduce((sum, p) => sum + p.amountCents, 0)).toBe(10000);
  });

  it('vendas de demonstração nunca mexem no estoque real', async () => {
    const before = await stockOf(fanId);
    await createSale({ customerId, saleDate: today, discountCents: 0, notes: null, items: [{ productId: fanId, description: 'Ventoinha', quantity: 3, unitPriceCents: 2500 }] }, actor, { isDemo: true });
    expect(await stockOf(fanId)).toBe(before);
  });

  it('recusa produto inexistente e valida a numeração sequencial', async () => {
    await expect(createSale({ customerId: null, saleDate: today, discountCents: 0, notes: null, items: [{ productId: 99999, description: 'Fantasma', quantity: 1, unitPriceCents: 100 }] }, actor)).rejects.toThrow(/não existe mais/);
    const list = await listSales({ pageSize: 50 });
    const numbers = list.rows.map((r) => r.number).sort((a, b) => a - b);
    expect(numbers).toEqual(numbers.map((_, i) => i + 1));
  });
});

describe('financeiro: entradas, custos e resultado', () => {
  let goodsId: number;
  let transportId: number;
  const from = addDaysISO(today, -3);

  it('categorias: mercadorias alimentam o "custo de mercadorias"; nomes não se repetem', async () => {
    const categories = await listExpenseCategories();
    goodsId = categories.find((c) => c.isGoods)!.id;
    transportId = categories.find((c) => c.name === 'Transporte')!.id;
    await saveExpenseCategory({ name: 'Categoria Nova', isGoods: false }, actor);
    await expect(saveExpenseCategory({ name: 'Categoria Nova', isGoods: true }, actor)).rejects.toThrow(/categoria com este nome/);
  });

  it('resultado = entradas − custos cadastrados; estornos e custos fora do período não entram', async () => {
    const base = await getFinanceSummary(from, today);

    await registerPayment({ amountCents: 30000, method: 'PIX', paidDate: today, description: 'Entrada avulsa A' }, actor);
    const voided = await registerPayment({ amountCents: 5000, method: 'DINHEIRO', paidDate: today, description: 'Entrada avulsa B' }, actor);
    await voidPayment(voided.id, 'lançada errado', actor);
    await registerPayment({ amountCents: 9999, method: 'CARTAO', paidDate: addDaysISO(today, -30), description: 'Fora do período' }, actor);

    await createExpense({ date: today, description: 'Compra de peças', supplier: 'Fornecedor X', categoryId: goodsId, amountCents: 12000, paymentMethod: 'PIX', notes: null }, actor);
    await createExpense({ date: today, description: 'Combustível', supplier: null, categoryId: transportId, amountCents: 3000, paymentMethod: null, notes: null }, actor);
    await createExpense({ date: addDaysISO(today, -40), description: 'Custo antigo', supplier: null, categoryId: transportId, amountCents: 777, paymentMethod: null, notes: null }, actor);

    const summary = await getFinanceSummary(from, today);
    expect(summary.incomeCents - base.incomeCents).toBe(30000);
    expect(summary.expenseCents - base.expenseCents).toBe(15000);
    expect(summary.goodsCents - base.goodsCents).toBe(12000);
    expect(summary.resultCents).toBe(summary.incomeCents - summary.expenseCents);

    const byMethod = await getIncomeByMethod(from, today);
    expect(byMethod.find((m) => m.method === 'CARTAO')?.cents ?? 0).toBe(0);
  });

  it('editar e excluir custos; categoria em uso não pode ser excluída', async () => {
    const expense = await createExpense({ date: today, description: 'Custo editável', supplier: null, categoryId: transportId, amountCents: 100, paymentMethod: null, notes: null }, actor);
    const updated = await updateExpense(expense.id, { date: today, description: 'Custo editado', supplier: 'F', categoryId: transportId, amountCents: 250, paymentMethod: 'DINHEIRO', notes: null }, actor);
    expect(updated.amountCents).toBe(250);
    await expect(deleteExpenseCategory(transportId, actor)).rejects.toThrow(/já possui custos/);
    await deleteExpense(expense.id, actor);
    await expect(deleteExpense(expense.id, actor)).rejects.toThrow(/não encontrad/i);
    const spare = (await listExpenseCategories()).find((c) => c.name === 'Categoria Nova')!;
    await deleteExpenseCategory(spare.id, actor);
    const [gone] = await getDb().select().from(expenseCategories).where(eq(expenseCategories.id, spare.id));
    expect(gone).toBeUndefined();
  });
});

describe('relatórios', () => {
  const period = resolvePeriod('30d', today, {});

  it('todos os tipos de relatório são gerados com KPIs, tabelas e resumo', async () => {
    for (const type of REPORT_TYPES) {
      const report = await buildReport(type, period, { today, timezone: 'America/Recife' });
      expect(report.type).toBe(type);
      expect(report.kpis.length).toBeGreaterThan(0);
      expect(report.tables.length).toBeGreaterThan(0);
      expect(report.period.from).toBe(period.from);
    }
  });

  it('relatório financeiro fecha com o resumo (entradas − custos)', async () => {
    const report = await buildReport('financeiro', period, { today, timezone: 'America/Recife' });
    const summary = report.summary as { incomeCents: number; expenseCents: number; resultCents: number };
    expect(summary.resultCents).toBe(summary.incomeCents - summary.expenseCents);
    const footer = report.tables[0]!.footer!;
    expect(footer[1]).toBe(summary.incomeCents);
    expect(footer[2]).toBe(summary.expenseCents);
    expect(footer[3]).toBe(summary.resultCents);
  });

  it('CSV para Excel: UTF-8 com BOM, ";" como separador, vírgula decimal e escape de aspas/ponto e vírgula', async () => {
    await createExpense({ date: today, description: 'Peça "especial"; com ponto e vírgula', supplier: null, categoryId: (await listExpenseCategories())[0]!.id, amountCents: 123456, paymentMethod: null, notes: null }, actor);
    const csv = reportToCsv(await buildReport('custos', period, { today, timezone: 'America/Recife' }));
    expect(csv.charCodeAt(0)).toBe(0xfeff);
    expect(csv).toContain('"Peça ""especial""; com ponto e vírgula"');
    expect(csv).toContain('1234,56');
    expect(csv.split('\r\n').length).toBeGreaterThan(5);
  });

  it('CSV neutraliza fórmulas (=, +, -, @) digitadas em textos, sem afetar valores numéricos', async () => {
    const category = (await listExpenseCategories())[0]!.id;
    await createExpense({ date: today, description: '=HYPERLINK("http://exemplo.com")', supplier: '@fornecedor', categoryId: category, amountCents: 500, paymentMethod: null, notes: null }, actor);
    const csv = reportToCsv(await buildReport('custos', period, { today, timezone: 'America/Recife' }));
    expect(csv).toContain(`"'=HYPERLINK(""http://exemplo.com"")"`);
    expect(csv).toContain("'@fornecedor");
    expect(csv).not.toMatch(/;=HYPERLINK|^=HYPERLINK/m);
    expect(csv).toContain('5,00'); // números continuam numéricos
  });
});

import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { eq, sql } from 'drizzle-orm';
import { DEFAULT_ROLES } from '@/config/permissions';
import type { Actor } from '@/server/auth/types';
import { getDb } from '@/server/db/client';
import { seedDemoData } from '@/server/db/seed/demo';
import { auditLogs, customers, products, serviceOrders, stockMovements } from '@/server/db/schema';
import { createCustomer } from '@/server/services/customers';
import { clearDemoData, countDemoData, hasDemoData } from '@/server/services/demo';
import { createOrder } from '@/server/services/orders';
import { globalSearch } from '@/server/services/search';
import { setupTestDb, teardownTestDb } from '../helpers/db';

let actor: Actor;
let realOrderNumber = 0;

beforeAll(async () => {
  ({ actor } = await setupTestDb('demo-search'));
});

afterAll(() => teardownTestDb());

describe('dados de demonstração', () => {
  it('sem carga de demonstração o sistema começa limpo', async () => {
    expect(await hasDemoData()).toBe(false);
  });

  it('carrega registros marcados como demonstração, sem alterar estoque real nem gerar trilha de auditoria', async () => {
    const stockBefore = await getDb().select({ stock: products.stock }).from(products);
    const auditBefore = await getDb().select({ n: sql<number>`count(*)` }).from(auditLogs);

    const result = await seedDemoData();
    expect(result.customers).toBeGreaterThan(0);
    expect(result.orders).toBeGreaterThan(0);
    expect(await hasDemoData()).toBe(true);

    const counts = await countDemoData();
    expect(counts.customers).toBe(result.customers);
    expect(counts.orders).toBe(result.orders);

    // tudo o que foi criado está marcado e identificado como demonstração
    const [notDemo] = await getDb().select({ n: sql<number>`count(*)` }).from(customers).where(eq(customers.isDemo, false));
    expect(Number(notDemo!.n)).toBe(0);
    const names = await getDb().select({ name: customers.name }).from(customers);
    expect(names.every((c) => c.name.startsWith('[DEMO]'))).toBe(true);

    const stockAfter = await getDb().select({ stock: products.stock }).from(products);
    expect(stockAfter).toEqual(stockBefore);
    const movements = await getDb().select({ n: sql<number>`count(*)` }).from(stockMovements);
    expect(Number(movements[0]!.n)).toBe(0);

    const auditAfter = await getDb().select({ n: sql<number>`count(*)` }).from(auditLogs);
    // apenas a limpeza inicial pode registrar algo; as centenas de ações fictícias não geram auditoria
    expect(Number(auditAfter[0]!.n) - Number(auditBefore[0]!.n)).toBeLessThanOrEqual(1);
  });

  it('carregar de novo não duplica os dados', async () => {
    const first = await countDemoData();
    await seedDemoData();
    expect(await countDemoData()).toEqual(first);
  });

  it('remover apaga só a demonstração e preserva clientes reais e suas ordens', async () => {
    const real = await createCustomer(
      { name: 'Cliente Real', phone: '(81) 98888-1234', whatsapp: null, document: null, email: null, address: null, notes: null },
      actor,
    );
    const order = await createOrder(
      {
        customerId: real.id,
        equipment: 'Bomba real',
        brand: null,
        model: null,
        problemDescription: null,
        diagnosis: null,
        serviceDescription: null,
        entryDate: '2026-09-01',
        expectedDeliveryDate: null,
        nextServiceDate: null,
        technicianId: null,
        paymentMethod: null,
        discountCents: 0,
        notes: null,
        items: [{ kind: 'SERVICE', description: 'Manutenção em geral', quantity: 1, unitPriceCents: 10000 }],
      },
      actor,
    );

    realOrderNumber = order.number;
    const removed = await clearDemoData();
    expect(removed.customers).toBeGreaterThan(0);
    expect(await hasDemoData()).toBe(false);

    const remaining = await getDb().select({ name: customers.name }).from(customers);
    expect(remaining.map((c) => c.name)).toEqual(['Cliente Real']);
    const [kept] = await getDb().select({ id: serviceOrders.id }).from(serviceOrders).where(eq(serviceOrders.id, order.id));
    expect(kept).toBeDefined();
  });
});

describe('busca global', () => {
  const seller = { permissions: DEFAULT_ROLES.find((r) => r.key === 'seller')!.permissions };
  const nobody = { permissions: [] as never[] };

  it('encontra clientes por nome e por telefone (só dígitos), e a OS pelo código', async () => {
    const byName = await globalSearch('Cliente Real', seller);
    expect(byName.groups.flatMap((g) => g.items).some((r) => r.title.includes('Cliente Real'))).toBe(true);

    const byPhone = await globalSearch('988881234', seller);
    expect(byPhone.groups.flatMap((g) => g.items).some((r) => r.title.includes('Cliente Real'))).toBe(true);

    const code = `OS-${String(realOrderNumber).padStart(6, '0')}`;
    const byCode = await globalSearch(code, seller);
    expect(byCode.direct?.type).toBe('order');
    expect(byCode.direct?.title).toContain(code);
  });

  it('respeita as permissões: quem não pode ver clientes/OS não recebe resultados', async () => {
    const result = await globalSearch('Cliente Real', nobody);
    expect(result.groups.flatMap((g) => g.items)).toHaveLength(0);
  });

  it('busca vazia ou curta demais não retorna nada nem quebra', async () => {
    expect((await globalSearch('', seller)).groups).toEqual([]);
    expect((await globalSearch('a', seller)).groups).toEqual([]);
  });
});

import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { and, asc, eq } from 'drizzle-orm';
import { STORE_DEFAULTS } from '@/config/store';
import { NotFoundError } from '@/server/auth/errors';
import type { Actor } from '@/server/auth/types';
import { getDb } from '@/server/db/client';
import { auditLogs, products, stockMovements } from '@/server/db/schema';
import { adjustStock, createProduct } from '@/server/services/products';
import { getStoreOverview, listStoreProducts, storeHasSellableProducts } from '@/server/services/store';
import { bulkUpdateStoreProducts, getProductNames, listStoreCatalog, storeCatalogSummary } from '@/server/services/store-catalog';
import { updateStoreSettings } from '@/server/services/store-settings';
import { setupTestDb, teardownTestDb } from '../helpers/db';

let actor: Actor;
const ids: Record<string, number> = {};

async function productRow(name: string) {
  const [row] = await getDb().select().from(products).where(eq(products.id, ids[name]!));
  return row!;
}

async function bulkAudits() {
  return getDb().select().from(auditLogs).where(eq(auditLogs.action, 'STORE_CATALOG_BULK'));
}

beforeAll(async () => {
  ({ actor } = await setupTestDb('store-catalog'));
  const rows = await getDb().select({ id: products.id, name: products.name }).from(products);
  for (const row of rows) ids[row.name] = row.id;
});

afterAll(() => teardownTestDb());

describe('instalação limpa: nada é inventado', () => {
  it('os 13 produtos oficiais nascem sem preço nem estoque (situação "Sem preço")', async () => {
    const summary = await storeCatalogSummary();
    expect(summary).toEqual({ total: 13, ON_SALE: 0, OUT_OF_STOCK: 0, NO_PRICE: 13, CONSULT_ONLY: 0, HIDDEN: 0 });
    const page = await listStoreCatalog({});
    expect(page.total).toBe(13);
    expect(page.rows.every((row) => row.salePriceCents === 0 && row.stock === 0)).toBe(true);
  });

  it('sem nada à venda a loja funciona como catálogo (sem carrinho), mesmo aberta', async () => {
    expect(await storeHasSellableProducts()).toBe(false);
    expect(await getStoreOverview()).toEqual({ enabled: true, demo: false, sellable: false });
  });
});

describe('edição rápida da loja', () => {
  it('grava preço, categoria, visibilidade e estoque (como ajuste relativo com histórico e auditoria)', async () => {
    const result = await bulkUpdateStoreProducts(
      [
        { id: ids['Rolamentos']!, salePriceCents: 3850, stockDelta: 40 },
        { id: ids['Capacitor permanente']!, salePriceCents: 4500, stockDelta: 3, category: 'Capacitores' },
        { id: ids['Selo mecânico']!, salePriceCents: 12000 }, // com preço, mas sem estoque
        { id: ids['Manômetro']!, sellOnline: false },
        { id: ids['Platinado']!, showOnSite: false },
      ],
      actor,
    );
    expect(result.ids).toHaveLength(5);
    expect(result.names).toEqual(['Rolamentos', 'Capacitor permanente', 'Selo mecânico', 'Manômetro', 'Platinado']);

    expect(await productRow('Rolamentos')).toMatchObject({ salePriceCents: 3850, stock: 40 });
    expect(await productRow('Capacitor permanente')).toMatchObject({ salePriceCents: 4500, stock: 3, category: 'Capacitores' });
    expect(await productRow('Manômetro')).toMatchObject({ sellOnline: false });
    expect(await productRow('Platinado')).toMatchObject({ showOnSite: false });

    const movements = await getDb().select().from(stockMovements).where(eq(stockMovements.productId, ids['Rolamentos']!));
    expect(movements).toHaveLength(1);
    expect(movements[0]).toMatchObject({ delta: 40, reason: 'ADJUSTMENT', note: 'Ajuste pela edição rápida da loja', createdBy: actor.id });

    const audits = await bulkAudits();
    expect(audits).toHaveLength(1);
    expect(audits[0]).toMatchObject({ userId: actor.id, entityType: 'products' });
    expect(audits[0]!.summary).toMatch(/5 produtos alterados/);
    expect((audits[0]!.data as { ids: number[] }).ids).toEqual(result.ids);
  });

  it('a situação de cada produto e os totais refletem o que foi salvo', async () => {
    expect(await storeCatalogSummary()).toEqual({ total: 13, ON_SALE: 2, OUT_OF_STOCK: 1, NO_PRICE: 8, CONSULT_ONLY: 1, HIDDEN: 1 });

    const onSale = await listStoreCatalog({ status: 'ON_SALE' });
    expect(onSale.rows.map((row) => row.name).sort()).toEqual(['Capacitor permanente', 'Rolamentos']);
    expect((await listStoreCatalog({ status: 'OUT_OF_STOCK' })).rows.map((row) => row.name)).toEqual(['Selo mecânico']);
    expect((await listStoreCatalog({ status: 'CONSULT_ONLY' })).rows.map((row) => row.name)).toEqual(['Manômetro']);
    expect((await listStoreCatalog({ status: 'HIDDEN' })).rows.map((row) => row.name)).toEqual(['Platinado']);
    expect((await listStoreCatalog({ status: 'NO_PRICE' })).total).toBe(8);
  });

  it('busca sem acento, inclusive pela nova categoria; paginação mantém o total', async () => {
    expect((await listStoreCatalog({ q: 'capacitores' })).rows.map((row) => row.name)).toEqual(['Capacitor permanente']);
    expect((await listStoreCatalog({ q: 'ROLAMENTO' })).rows.map((row) => row.name)).toEqual(['Rolamentos']);
    expect((await listStoreCatalog({ q: 'nao-existe-esse-item' })).total).toBe(0);
    expect((await listStoreCatalog({ q: 'capacitor', status: 'ON_SALE' })).total).toBe(1);

    const first = await listStoreCatalog({ pageSize: 5, page: 1 });
    const third = await listStoreCatalog({ pageSize: 5, page: 3 });
    expect(first.total).toBe(13);
    expect(first.rows).toHaveLength(5);
    expect(third.rows).toHaveLength(3);
    expect(new Set([...first.rows, ...third.rows].map((row) => row.id)).size).toBe(8);
  });

  it('a loja passa a vender o que ficou "à venda" e some o que foi ocultado', async () => {
    expect(await storeHasSellableProducts()).toBe(true);
    expect(await getStoreOverview()).toEqual({ enabled: true, demo: false, sellable: true });

    const store = await listStoreProducts();
    const byName = new Map(store.products.map((product) => [product.name, product]));
    expect(byName.get('Rolamentos')).toMatchObject({ priceCents: 3850, purchasable: true, available: 40 });
    expect(byName.get('Selo mecânico')).toMatchObject({ priceCents: 12000, purchasable: false, state: 'OUT_OF_STOCK' });
    expect(byName.get('Manômetro')).toMatchObject({ purchasable: false, state: 'CONSULT' });
    expect(byName.has('Platinado')).toBe(false);
  });

  it('só grava o que mudou: valores iguais ao atual não geram histórico nem auditoria', async () => {
    const auditsBefore = (await bulkAudits()).length;
    const movementsBefore = await getDb().select().from(stockMovements).where(eq(stockMovements.productId, ids['Rolamentos']!));

    const result = await bulkUpdateStoreProducts([{ id: ids['Rolamentos']!, salePriceCents: 3850, category: (await productRow('Rolamentos')).category, sellOnline: true, showOnSite: true, stockDelta: 0 }], actor);
    expect(result).toEqual({ ids: [], names: [] });
    expect(await bulkAudits()).toHaveLength(auditsBefore);
    expect(await getDb().select().from(stockMovements).where(eq(stockMovements.productId, ids['Rolamentos']!))).toHaveLength(movementsBefore.length);
  });

  it('o estoque é relativo: uma venda feita com a tela aberta não é desfeita', async () => {
    // A tela abriu com 40 unidades; enquanto isso, 5 foram vendidas (saldo real: 35).
    await adjustStock(ids['Rolamentos']!, { mode: 'REMOVE', quantity: 5, note: 'venda simulada' }, actor);
    // A equipe recebeu 10 unidades e lançou "+10" na edição rápida.
    await bulkUpdateStoreProducts([{ id: ids['Rolamentos']!, stockDelta: 10 }], actor);
    expect((await productRow('Rolamentos')).stock).toBe(45); // 35 + 10 (e não 40 + 10 = 50)

    // O saldo continua sendo a soma do livro-razão.
    const movements = await getDb().select({ delta: stockMovements.delta }).from(stockMovements).where(eq(stockMovements.productId, ids['Rolamentos']!)).orderBy(asc(stockMovements.id));
    expect(movements.reduce((sum, row) => sum + row.delta, 0)).toBe(45);
  });

  it('produto inexistente cancela o lote inteiro (nada é gravado pela metade)', async () => {
    const before = await productRow('Rotor');
    await expect(bulkUpdateStoreProducts([{ id: ids['Rotor']!, salePriceCents: 9900, stockDelta: 7 }, { id: 999_999, salePriceCents: 100 }], actor)).rejects.toBeInstanceOf(NotFoundError);
    const after = await productRow('Rotor');
    expect(after.salePriceCents).toBe(before.salePriceCents);
    expect(after.stock).toBe(before.stock);
    const moved = await getDb()
      .select()
      .from(stockMovements)
      .where(and(eq(stockMovements.productId, ids['Rotor']!), eq(stockMovements.reason, 'ADJUSTMENT')));
    expect(moved).toHaveLength(0);
  });

  it('nomes dos produtos para as mensagens de erro da tela', async () => {
    const names = await getProductNames([ids['Rolamentos']!, ids['Rotor']!, 999_999]);
    expect(names.get(ids['Rolamentos']!)).toBe('Rolamentos');
    expect(names.get(ids['Rotor']!)).toBe('Rotor');
    expect(names.has(999_999)).toBe(false);
    expect((await getProductNames([])).size).toBe(0);
  });
});

describe('adicionar item à loja (cadastro rápido)', () => {
  it('nome, categoria, preço e estoque: já entra à venda e aparece na loja', async () => {
    const created = await createProduct(
      {
        name: 'Capacitor 25 µF',
        code: null,
        category: 'Capacitores',
        salePriceCents: 2900,
        costCents: 0,
        stock: 12,
        minStock: 0,
        unit: 'un',
        notes: null,
        iconKey: 'component',
        isActive: true,
        showOnSite: true,
        sellOnline: true,
        storeDescription: null,
      },
      actor,
    );
    expect(created.code).toMatch(/^PRD-\d{4}$/);
    expect(created).toMatchObject({ stock: 12, salePriceCents: 2900 });

    const summary = await storeCatalogSummary();
    expect(summary.total).toBe(14);
    expect(summary.ON_SALE).toBe(3);

    const found = await listStoreProducts({ q: 'capacitor 25' });
    expect(found.products.map((product) => product.name)).toEqual(['Capacitor 25 µF']);
    expect(found.products[0]).toMatchObject({ purchasable: true, priceCents: 2900, available: 12 });
  });

  it('sem preço o item fica listado como "valor sob consulta", nunca com preço inventado', async () => {
    const created = await createProduct(
      { name: 'Polia dupla', code: null, category: 'Peças', salePriceCents: 0, costCents: 0, stock: 0, minStock: 0, unit: 'un', notes: null, iconKey: 'component', isActive: true, showOnSite: true, sellOnline: true, storeDescription: null },
      actor,
    );
    const catalog = (await listStoreCatalog({ q: 'polia dupla' })).rows;
    expect(catalog).toHaveLength(1);
    expect(catalog[0]!.id).toBe(created.id);
    const store = (await listStoreProducts({ q: 'polia dupla' })).products;
    expect(store[0]).toMatchObject({ priceCents: null, purchasable: false, state: 'CONSULT' });
  });
});

describe('modo catálogo (nada à venda)', () => {
  it('loja fechada ou sem produto vendável: sem carrinho; o preço de demonstração só vale sem preço real', async () => {
    // Loja fechada: mesmo com produtos à venda, não há carrinho.
    await updateStoreSettings({ ...STORE_DEFAULTS, enabled: false }, actor);
    expect(await getStoreOverview()).toMatchObject({ enabled: false, sellable: false });
    await updateStoreSettings({ ...STORE_DEFAULTS, enabled: true }, actor);
    expect(await getStoreOverview()).toMatchObject({ enabled: true, sellable: true });

    // Tira tudo do ar: sem estoque, oculto ou só consulta → catálogo.
    const all = await getDb().select({ id: products.id, stock: products.stock }).from(products);
    await bulkUpdateStoreProducts(
      all.filter((row) => row.stock > 0).map((row) => ({ id: row.id, stockDelta: -row.stock })),
      actor,
    );
    expect(await storeHasSellableProducts()).toBe(false);
    expect((await getStoreOverview()).sellable).toBe(false);

    // Um preço de demonstração (só existe com dados de demonstração) libera a vitrine de teste.
    await getDb().update(products).set({ demoPriceCents: 5000 }).where(eq(products.id, ids['Ventoinha']!));
    expect(await storeHasSellableProducts()).toBe(true);
    expect(await getStoreOverview()).toMatchObject({ demo: true, sellable: true });
    // ...mas nunca quando o produto já tem preço real (o preço de demonstração é ignorado).
    await getDb().update(products).set({ salePriceCents: 1000 }).where(eq(products.id, ids['Ventoinha']!));
    expect(await storeHasSellableProducts()).toBe(false);
  });
});

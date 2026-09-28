import { and, asc, desc, eq, sql } from 'drizzle-orm';
import { formatProductCode } from '@/lib/codes';
import type { ProductFormInput, StockAdjustInput } from '@/lib/validation/catalog';
import { BusinessError, NotFoundError } from '../auth/errors';
import type { Actor } from '../auth/types';
import { getDb, isUniqueViolation, runWrite, type DbOrTx, type Tx } from '../db/client';
import { products, saleItems, serviceOrderItems, stockMovements, users, type Product } from '../db/schema';
import { audit } from './audit';
import { allOf, likeAllTokens, type PageResult } from './query-utils';
import { productSearchText } from './search-text';
import { recordMovement } from './stock';

export const PRODUCT_SORT_KEYS = ['name', 'code', 'category', 'stock', 'price'] as const;
export type ProductSortKey = (typeof PRODUCT_SORT_KEYS)[number];

/** Estoque baixo: há mínimo definido e o saldo chegou (ou passou) dele. */
const lowStockSql = sql`(${products.minStock} > 0 AND ${products.stock} <= ${products.minStock})`;

export async function listProducts(params: {
  q?: string;
  category?: string;
  low?: boolean;
  activeOnly?: boolean;
  sort?: ProductSortKey;
  dir?: 'asc' | 'desc';
  page?: number;
  pageSize?: number;
}): Promise<PageResult<Product>> {
  const db = getDb();
  const pageSize = params.pageSize ?? 20;
  const page = Math.max(1, params.page ?? 1);
  const where = allOf(
    likeAllTokens(products.searchText, params.q),
    params.category ? eq(products.category, params.category) : undefined,
    params.low ? lowStockSql : undefined,
    params.activeOnly ? eq(products.isActive, true) : undefined,
  );
  const sortColumn = {
    name: sql`${products.name} COLLATE NOCASE`,
    code: products.code,
    category: sql`${products.category} COLLATE NOCASE`,
    stock: products.stock,
    price: products.salePriceCents,
  }[params.sort ?? 'name'];
  const dir = params.dir === 'desc' ? desc : asc;

  const rows = await db
    .select()
    .from(products)
    .where(where)
    .orderBy(dir(sortColumn), asc(products.id))
    .limit(pageSize)
    .offset((page - 1) * pageSize);
  const [{ total }] = await db.select({ total: sql<number>`count(*)` }).from(products).where(where);
  return { rows, total: Number(total) };
}

export async function getProduct(id: number, db: DbOrTx = getDb()): Promise<Product | null> {
  const [row] = await db.select().from(products).where(eq(products.id, id)).limit(1);
  return row ?? null;
}

export async function listProductCategories(): Promise<string[]> {
  const rows = await getDb().selectDistinct({ category: products.category }).from(products).orderBy(asc(products.category));
  return rows.map((r) => r.category);
}

export async function productsSummary() {
  const [row] = await getDb()
    .select({
      total: sql<number>`count(*)`,
      active: sql<number>`sum(CASE WHEN ${products.isActive} = 1 THEN 1 ELSE 0 END)`,
      low: sql<number>`sum(CASE WHEN ${products.isActive} = 1 AND ${lowStockSql} THEN 1 ELSE 0 END)`,
      negative: sql<number>`sum(CASE WHEN ${products.stock} < 0 THEN 1 ELSE 0 END)`,
      costValue: sql<number>`COALESCE(SUM(CASE WHEN ${products.stock} > 0 THEN ${products.stock} * ${products.costCents} ELSE 0 END), 0)`,
      saleValue: sql<number>`COALESCE(SUM(CASE WHEN ${products.stock} > 0 THEN ${products.stock} * ${products.salePriceCents} ELSE 0 END), 0)`,
    })
    .from(products);
  return {
    total: Number(row?.total ?? 0),
    active: Number(row?.active ?? 0),
    low: Number(row?.low ?? 0),
    negative: Number(row?.negative ?? 0),
    costValueCents: Number(row?.costValue ?? 0),
    saleValueCents: Number(row?.saleValue ?? 0),
  };
}

/** Produtos ativos com estoque baixo (alertas). */
export async function listLowStockProducts(limit = 10) {
  return getDb()
    .select({ id: products.id, name: products.name, stock: products.stock, minStock: products.minStock, unit: products.unit })
    .from(products)
    .where(and(eq(products.isActive, true), lowStockSql))
    .orderBy(asc(sql`${products.stock} - ${products.minStock}`), asc(products.name))
    .limit(limit);
}

/** Para seletores de OS/venda: apenas produtos ativos. */
export async function searchProductsForSelect(q: string, limit = 8) {
  return getDb()
    .select({
      id: products.id,
      name: products.name,
      code: products.code,
      salePriceCents: products.salePriceCents,
      costCents: products.costCents,
      stock: products.stock,
      unit: products.unit,
    })
    .from(products)
    .where(allOf(eq(products.isActive, true), likeAllTokens(products.searchText, q)))
    .orderBy(asc(sql`${products.name} COLLATE NOCASE`))
    .limit(limit);
}

async function nextProductCode(tx: Tx): Promise<string> {
  const [row] = await tx
    .select({ max: sql<number>`COALESCE(MAX(CAST(SUBSTR(${products.code}, 5) AS INTEGER)), 0)` })
    .from(products)
    .where(sql`${products.code} GLOB 'PRD-[0-9]*'`);
  return formatProductCode(Number(row?.max ?? 0) + 1);
}

export async function createProduct(input: ProductFormInput, actor: Actor): Promise<Product> {
  try {
    return await runWrite(async (tx) => {
      const code = input.code ?? (await nextProductCode(tx));
      const [maxOrder] = await tx.select({ n: sql<number>`COALESCE(MAX(${products.sortOrder}), -1)` }).from(products);
      const [created] = await tx
        .insert(products)
        .values({
          code,
          name: input.name,
          category: input.category,
          salePriceCents: input.salePriceCents,
          costCents: input.costCents,
          stock: 0,
          minStock: input.minStock,
          unit: input.unit,
          notes: input.notes,
          iconKey: input.iconKey,
          isActive: input.isActive,
          showOnSite: input.showOnSite,
          sellOnline: input.sellOnline,
          storeDescription: input.storeDescription,
          sortOrder: Number(maxOrder?.n ?? -1) + 1,
          searchText: productSearchText({ name: input.name, code, category: input.category }),
        })
        .returning();
      if (input.stock > 0) {
        await recordMovement(tx, { productId: created!.id, delta: input.stock, reason: 'INITIAL', note: 'Estoque inicial', actorId: actor.id });
      }
      await audit({ actor, action: 'PRODUCT_CREATE', entityType: 'products', entityId: created!.id, summary: `Produto cadastrado: ${created!.name}` });
      return (await getProduct(created!.id, tx))!;
    });
  } catch (error) {
    throw translateProductError(error);
  }
}

export async function updateProduct(id: number, input: ProductFormInput, actor: Actor): Promise<Product> {
  try {
    return await runWrite(async (tx) => {
      const existing = await getProduct(id, tx);
      if (!existing) throw new NotFoundError('Produto');
      const code = input.code ?? existing.code ?? (await nextProductCode(tx));
      const [updated] = await tx
        .update(products)
        .set({
          code,
          name: input.name,
          category: input.category,
          salePriceCents: input.salePriceCents,
          costCents: input.costCents,
          minStock: input.minStock,
          unit: input.unit,
          notes: input.notes,
          iconKey: input.iconKey,
          isActive: input.isActive,
          showOnSite: input.showOnSite,
          sellOnline: input.sellOnline,
          storeDescription: input.storeDescription,
          searchText: productSearchText({ name: input.name, code, category: input.category }),
        })
        .where(eq(products.id, id))
        .returning();
      await audit({ actor, action: 'PRODUCT_UPDATE', entityType: 'products', entityId: id, summary: `Produto atualizado: ${input.name}` });
      return updated!;
    });
  } catch (error) {
    throw translateProductError(error);
  }
}

function translateProductError(error: unknown): unknown {
  if (isUniqueViolation(error)) {
    const text = String((error as Error).message);
    if (/products\.code/i.test(text)) return new BusinessError('Já existe um produto com este código.', 'code');
    if (/products\.name/i.test(text)) return new BusinessError('Já existe um produto com este nome.', 'name');
    return new BusinessError('Já existe um produto com estes dados.');
  }
  return error;
}

/** Produtos usados em OS ou vendas não podem ser excluídos (preserva o histórico): desative-os. */
export async function deleteProduct(id: number, actor: Actor): Promise<void> {
  await runWrite(async (tx) => {
    const existing = await getProduct(id, tx);
    if (!existing) throw new NotFoundError('Produto');
    const [a] = await tx.select({ n: sql<number>`count(*)` }).from(serviceOrderItems).where(eq(serviceOrderItems.productId, id));
    const [b] = await tx.select({ n: sql<number>`count(*)` }).from(saleItems).where(eq(saleItems.productId, id));
    if (Number(a?.n) + Number(b?.n) > 0) {
      throw new BusinessError('Este produto já foi usado em ordens de serviço ou vendas. Para preservar o histórico, desative-o em vez de excluir.');
    }
    await tx.delete(products).where(eq(products.id, id));
    await audit({ actor, action: 'PRODUCT_DELETE', entityType: 'products', entityId: id, summary: `Produto excluído: ${existing.name}` });
  });
}

export async function adjustStock(id: number, input: StockAdjustInput, actor: Actor): Promise<Product> {
  return runWrite(async (tx) => {
    const product = await getProduct(id, tx);
    if (!product) throw new NotFoundError('Produto');
    let delta: number;
    let reason: 'PURCHASE' | 'ADJUSTMENT';
    if (input.mode === 'ADD') {
      delta = input.quantity;
      reason = 'PURCHASE';
    } else if (input.mode === 'REMOVE') {
      delta = -input.quantity;
      reason = 'ADJUSTMENT';
    } else {
      delta = input.quantity - product.stock;
      reason = 'ADJUSTMENT';
    }
    if (delta === 0) throw new BusinessError('O ajuste não altera o estoque atual.', 'quantity');
    await recordMovement(tx, {
      productId: id,
      delta,
      reason,
      note: input.note ?? (input.mode === 'SET' ? `Saldo definido para ${input.quantity}` : null),
      actorId: actor.id,
    });
    await audit({ actor, action: 'STOCK_ADJUST', entityType: 'products', entityId: id, summary: `Estoque de ${product.name}: ${delta > 0 ? '+' : ''}${delta}`, data: { delta, mode: input.mode } });
    return (await getProduct(id, tx))!;
  });
}

export async function listStockMovements(productId: number, limit = 30) {
  return getDb()
    .select({
      id: stockMovements.id,
      delta: stockMovements.delta,
      reason: stockMovements.reason,
      refType: stockMovements.refType,
      refId: stockMovements.refId,
      /** Número exibível (OS-000123 / VD-000045) da origem do movimento. */
      refNumber: sql<number | null>`CASE ${stockMovements.refType} WHEN 'service_order' THEN (SELECT o.number FROM service_orders o WHERE o.id = ${stockMovements.refId}) WHEN 'sale' THEN (SELECT s.number FROM sales s WHERE s.id = ${stockMovements.refId}) END`,
      note: stockMovements.note,
      createdAt: stockMovements.createdAt,
      userName: users.name,
    })
    .from(stockMovements)
    .leftJoin(users, eq(users.id, stockMovements.createdBy))
    .where(eq(stockMovements.productId, productId))
    .orderBy(desc(stockMovements.createdAt), desc(stockMovements.id))
    .limit(limit);
}

/** Produtos exibidos no site público (ativos e marcados para o site). */
export async function listSiteProducts() {
  return getDb()
    .select({ id: products.id, name: products.name, category: products.category, iconKey: products.iconKey, imageFileId: products.imageFileId })
    .from(products)
    .where(and(eq(products.isActive, true), eq(products.showOnSite, true)))
    .orderBy(asc(products.sortOrder), asc(products.name));
}

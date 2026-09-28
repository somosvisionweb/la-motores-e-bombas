/**
 * Loja virtual — gestão dos produtos pela equipe: situação de cada item na loja, listagem com filtros
 * e "edição rápida" (categoria, preço, estoque e visibilidade de vários produtos de uma vez).
 */
import { asc, eq, inArray, sql, type SQL } from 'drizzle-orm';
import type { StoreListingStatus } from '@/lib/store-pricing';
import { NotFoundError } from '../auth/errors';
import type { Actor } from '../auth/types';
import { getDb, runWrite } from '../db/client';
import { products, type Product } from '../db/schema';
import { audit } from './audit';
import { allOf, likeAllTokens, type PageResult } from './query-utils';
import { productSearchText } from './search-text';
import { recordMovement } from './stock';

const visible = sql`${products.isActive} = 1 AND ${products.showOnSite} = 1`;

/** Condição SQL de cada situação (espelha `storeListingStatus`, que decide o mesmo em memória). */
const LISTING_SQL: Record<StoreListingStatus, SQL> = {
  HIDDEN: sql`(${products.isActive} = 0 OR ${products.showOnSite} = 0)`,
  CONSULT_ONLY: sql`(${visible} AND ${products.sellOnline} = 0)`,
  NO_PRICE: sql`(${visible} AND ${products.sellOnline} = 1 AND ${products.salePriceCents} <= 0)`,
  OUT_OF_STOCK: sql`(${visible} AND ${products.sellOnline} = 1 AND ${products.salePriceCents} > 0 AND ${products.stock} <= 0)`,
  ON_SALE: sql`(${visible} AND ${products.sellOnline} = 1 AND ${products.salePriceCents} > 0 AND ${products.stock} > 0)`,
};

export async function listStoreCatalog(params: { q?: string; status?: StoreListingStatus; page?: number; pageSize?: number }): Promise<PageResult<Product>> {
  const db = getDb();
  const pageSize = params.pageSize ?? 50;
  const page = Math.max(1, params.page ?? 1);
  const where = allOf(likeAllTokens(products.searchText, params.q), params.status ? LISTING_SQL[params.status] : undefined);
  const rows = await db
    .select()
    .from(products)
    .where(where)
    .orderBy(asc(products.sortOrder), asc(sql`${products.name} COLLATE NOCASE`))
    .limit(pageSize)
    .offset((page - 1) * pageSize);
  const [total] = await db.select({ n: sql<number>`count(*)` }).from(products).where(where);
  return { rows, total: Number(total?.n ?? 0) };
}

/** Nomes de vários produtos (mensagens de erro da edição rápida). */
export async function getProductNames(ids: number[]): Promise<Map<number, string>> {
  if (ids.length === 0) return new Map();
  const rows = await getDb().select({ id: products.id, name: products.name }).from(products).where(inArray(products.id, ids));
  return new Map(rows.map((row) => [row.id, row.name]));
}

export type StoreCatalogSummary = Record<StoreListingStatus, number> & { total: number };

/** Quantos produtos há em cada situação (cartões do topo da tela). */
export async function storeCatalogSummary(): Promise<StoreCatalogSummary> {
  const [row] = await getDb().all<Record<StoreListingStatus | 'total', number>>(sql`
    SELECT COUNT(*) AS total,
           COALESCE(SUM(CASE WHEN ${LISTING_SQL.ON_SALE} THEN 1 ELSE 0 END), 0) AS ON_SALE,
           COALESCE(SUM(CASE WHEN ${LISTING_SQL.OUT_OF_STOCK} THEN 1 ELSE 0 END), 0) AS OUT_OF_STOCK,
           COALESCE(SUM(CASE WHEN ${LISTING_SQL.NO_PRICE} THEN 1 ELSE 0 END), 0) AS NO_PRICE,
           COALESCE(SUM(CASE WHEN ${LISTING_SQL.CONSULT_ONLY} THEN 1 ELSE 0 END), 0) AS CONSULT_ONLY,
           COALESCE(SUM(CASE WHEN ${LISTING_SQL.HIDDEN} THEN 1 ELSE 0 END), 0) AS HIDDEN
      FROM products
  `);
  return {
    total: Number(row?.total ?? 0),
    ON_SALE: Number(row?.ON_SALE ?? 0),
    OUT_OF_STOCK: Number(row?.OUT_OF_STOCK ?? 0),
    NO_PRICE: Number(row?.NO_PRICE ?? 0),
    CONSULT_ONLY: Number(row?.CONSULT_ONLY ?? 0),
    HIDDEN: Number(row?.HIDDEN ?? 0),
  };
}

/** Alterações de um produto na edição rápida: só o que mudou (o resto não é regravado). */
export interface BulkProductChange {
  id: number;
  category?: string;
  salePriceCents?: number;
  sellOnline?: boolean;
  showOnSite?: boolean;
  /** Variação do estoque (positiva = entrada). É relativa: vendas feitas enquanto a tela estava aberta não são desfeitas. */
  stockDelta?: number;
}

export async function bulkUpdateStoreProducts(changes: BulkProductChange[], actor: Actor): Promise<{ ids: number[]; names: string[] }> {
  return runWrite(async (tx) => {
    const ids: number[] = [];
    const names: string[] = [];
    for (const change of changes) {
      const [product] = await tx.select().from(products).where(eq(products.id, change.id)).limit(1);
      if (!product) throw new NotFoundError('Produto');

      const patch: Partial<typeof products.$inferInsert> = {};
      if (change.category !== undefined && change.category !== product.category) {
        patch.category = change.category;
        patch.searchText = productSearchText({ name: product.name, code: product.code, category: change.category });
      }
      if (change.salePriceCents !== undefined && change.salePriceCents !== product.salePriceCents) patch.salePriceCents = change.salePriceCents;
      if (change.sellOnline !== undefined && change.sellOnline !== product.sellOnline) patch.sellOnline = change.sellOnline;
      if (change.showOnSite !== undefined && change.showOnSite !== product.showOnSite) patch.showOnSite = change.showOnSite;
      const delta = change.stockDelta ?? 0;
      if (Object.keys(patch).length === 0 && delta === 0) continue;

      if (Object.keys(patch).length > 0) await tx.update(products).set(patch).where(eq(products.id, product.id));
      if (delta !== 0) {
        await recordMovement(tx, { productId: product.id, delta, reason: 'ADJUSTMENT', note: 'Ajuste pela edição rápida da loja', actorId: actor.id });
      }
      ids.push(product.id);
      names.push(product.name);
    }
    if (ids.length > 0) {
      await audit({ actor, action: 'STORE_CATALOG_BULK', entityType: 'products', summary: `Edição rápida da loja: ${ids.length} ${ids.length === 1 ? 'produto alterado' : 'produtos alterados'}`, data: { ids } });
    }
    return { ids, names };
  });
}

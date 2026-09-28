/**
 * Loja virtual — catálogo público e resolução do carrinho.
 * O servidor é a autoridade sobre preço e estoque: o navegador só guarda "produto + quantidade".
 */
import { and, asc, desc, eq, inArray, sql } from 'drizzle-orm';
import { sanitizeCartInput } from '@/lib/store-cart';
import { computeStorePricing, productPath, type Pricing } from '@/lib/store-pricing';
import { getDb, type DbOrTx } from '../db/client';
import { products, type Product } from '../db/schema';
import { allOf, likeAllTokens } from './query-utils';
import { getStoreSettings, type StoreConfig } from './store-settings';

export const STORE_SORT_KEYS = ['relevancia', 'nome', 'menor-preco', 'maior-preco'] as const;
export type StoreSortKey = (typeof STORE_SORT_KEYS)[number];

export interface StoreProduct extends Pricing {
  id: number;
  name: string;
  category: string;
  unit: string;
  iconKey: string | null;
  imageFileId: number | null;
  description: string | null;
  href: string;
}

const columns = {
  id: products.id,
  name: products.name,
  category: products.category,
  unit: products.unit,
  iconKey: products.iconKey,
  imageFileId: products.imageFileId,
  description: products.storeDescription,
  salePriceCents: products.salePriceCents,
  demoPriceCents: products.demoPriceCents,
  stock: products.stock,
  sellOnline: products.sellOnline,
};

type Row = Pick<Product, 'id' | 'name' | 'category' | 'unit' | 'iconKey' | 'imageFileId' | 'salePriceCents' | 'demoPriceCents' | 'stock' | 'sellOnline'> & {
  description: string | null;
};

function toStoreProduct(row: Row, config: Pick<StoreConfig, 'enabled'>): StoreProduct {
  const pricing = computeStorePricing(row, config.enabled);
  return {
    id: row.id,
    name: row.name,
    category: row.category,
    unit: row.unit,
    iconKey: row.iconKey,
    imageFileId: row.imageFileId,
    description: row.description,
    href: productPath(row.id, row.name),
    ...pricing,
  };
}

/** Produtos que aparecem no site (ativos e marcados para o site). */
const visible = and(eq(products.isActive, true), eq(products.showOnSite, true));

const effectivePriceSql = sql`COALESCE(NULLIF(${products.salePriceCents}, 0), ${products.demoPriceCents})`;

export interface StoreCatalog {
  config: StoreConfig;
  products: StoreProduct[];
  categories: { name: string; count: number }[];
  /** Existe algum preço de demonstração ativo (a loja exibe o aviso de demonstração). */
  demo: boolean;
}

export async function listStoreProducts(params: { q?: string; category?: string; sort?: StoreSortKey; limit?: number } = {}): Promise<StoreCatalog> {
  const db = getDb();
  const config = await getStoreSettings();

  const where = allOf(visible, likeAllTokens(products.searchText, params.q), params.category ? eq(products.category, params.category) : undefined);
  const order = {
    relevancia: [asc(products.sortOrder), asc(sql`${products.name} COLLATE NOCASE`)],
    nome: [asc(sql`${products.name} COLLATE NOCASE`)],
    // Sem preço (consultar valor) vai sempre para o fim.
    'menor-preco': [asc(sql`${effectivePriceSql} IS NULL`), asc(effectivePriceSql), asc(sql`${products.name} COLLATE NOCASE`)],
    'maior-preco': [asc(sql`${effectivePriceSql} IS NULL`), desc(effectivePriceSql), asc(sql`${products.name} COLLATE NOCASE`)],
  }[params.sort ?? 'relevancia'];

  const query = db.select(columns).from(products).where(where).orderBy(...order);
  const rows = await (params.limit ? query.limit(params.limit) : query);

  const categoryRows = await db
    .select({ name: products.category, count: sql<number>`count(*)` })
    .from(products)
    .where(visible)
    .groupBy(products.category)
    .orderBy(asc(sql`${products.category} COLLATE NOCASE`));

  return {
    config,
    products: rows.map((row) => toStoreProduct(row, config)),
    categories: categoryRows.map((c) => ({ name: c.name, count: Number(c.count) })),
    demo: await storeHasDemoPrices(),
  };
}

export async function getStoreProduct(id: number): Promise<{ product: StoreProduct; config: StoreConfig } | null> {
  const config = await getStoreSettings();
  const [row] = await getDb()
    .select(columns)
    .from(products)
    .where(and(eq(products.id, id), visible))
    .limit(1);
  return row ? { product: toStoreProduct(row, config), config } : null;
}

/** Produtos da loja por id (somente os visíveis no site), com preço e disponibilidade calculados. */
export async function loadStoreProducts(db: DbOrTx, ids: number[], config: Pick<StoreConfig, 'enabled'>): Promise<Map<number, StoreProduct>> {
  if (ids.length === 0) return new Map();
  const rows = await db
    .select(columns)
    .from(products)
    .where(and(inArray(products.id, ids), visible));
  return new Map(rows.map((row) => [row.id, toStoreProduct(row, config)]));
}

/** Sugestões na página do produto: mesma categoria primeiro, depois os demais. */
export async function listRelatedStoreProducts(product: Pick<StoreProduct, 'id' | 'category'>, limit = 4): Promise<StoreProduct[]> {
  const config = await getStoreSettings();
  const rows = await getDb()
    .select(columns)
    .from(products)
    .where(and(visible, sql`${products.id} <> ${product.id}`))
    .orderBy(asc(sql`CASE WHEN ${products.category} = ${product.category} THEN 0 ELSE 1 END`), asc(products.sortOrder), asc(sql`${products.name} COLLATE NOCASE`))
    .limit(limit);
  return rows.map((row) => toStoreProduct(row, config));
}

/** Há produtos com preço de demonstração em uso (preço real ainda não cadastrado)? */
export async function storeHasDemoPrices(): Promise<boolean> {
  const rows = await getDb().all<{ found: number }>(sql`
    SELECT 1 AS found FROM products
     WHERE demo_price_cents IS NOT NULL AND demo_price_cents > 0 AND sale_price_cents = 0 AND is_active = 1 AND show_on_site = 1
     LIMIT 1
  `);
  return rows.length > 0;
}

export interface StoreReadiness {
  /** Produtos que aparecem no site. */
  visible: number;
  /** Com preço real cadastrado. */
  withPrice: number;
  /** Prontos para vender online (preço real, estoque e "vender na loja" marcado). */
  sellable: number;
  demoPrices: boolean;
}

/** Quanto do catálogo já está pronto para vender: orienta a empresa em Configurações → Loja virtual. */
export async function getStoreReadiness(): Promise<StoreReadiness> {
  const [row] = await getDb().all<{ visible: number; withPrice: number; sellable: number }>(sql`
    SELECT COUNT(*) AS visible,
           COALESCE(SUM(CASE WHEN sale_price_cents > 0 THEN 1 ELSE 0 END), 0) AS withPrice,
           COALESCE(SUM(CASE WHEN sale_price_cents > 0 AND stock > 0 AND sell_online = 1 THEN 1 ELSE 0 END), 0) AS sellable
      FROM products WHERE is_active = 1 AND show_on_site = 1
  `);
  return {
    visible: Number(row?.visible ?? 0),
    withPrice: Number(row?.withPrice ?? 0),
    sellable: Number(row?.sellable ?? 0),
    demoPrices: await storeHasDemoPrices(),
  };
}

/** Existe ao menos um produto que o cliente consegue comprar agora (preço real + estoque, ou preço de demonstração)? */
export async function storeHasSellableProducts(): Promise<boolean> {
  const rows = await getDb().all<{ found: number }>(sql`
    SELECT 1 AS found FROM products
     WHERE is_active = 1 AND show_on_site = 1 AND sell_online = 1
       AND ((sale_price_cents > 0 AND stock > 0) OR (sale_price_cents = 0 AND demo_price_cents > 0))
     LIMIT 1
  `);
  return rows.length > 0;
}

/**
 * Visão rápida para o cabeçalho e a página inicial: loja aberta? há demonstração? há algo à venda?
 * Sem nada à venda a loja funciona como catálogo ("valor sob consulta"): sem carrinho nem promessa de compra.
 */
export async function getStoreOverview(): Promise<{ enabled: boolean; demo: boolean; sellable: boolean }> {
  const [config, demo, sellable] = await Promise.all([getStoreSettings(), storeHasDemoPrices(), storeHasSellableProducts()]);
  return { enabled: config.enabled, demo, sellable: config.enabled && sellable };
}

// ---------------------------------------------------------------------------
// Carrinho
// ---------------------------------------------------------------------------

export type CartIssue = 'UNAVAILABLE' | 'OUT_OF_STOCK' | 'INSUFFICIENT';

export interface CartLine {
  productId: number;
  name: string;
  unit: string;
  iconKey: string | null;
  imageFileId: number | null;
  href: string;
  unitPriceCents: number;
  isDemoPrice: boolean;
  quantity: number;
  /** Quantidade máxima que pode ser comprada agora. */
  available: number;
  lineTotalCents: number;
  issue: CartIssue | null;
}

export interface CartResolution {
  lines: CartLine[];
  /** Produtos do carrinho que deixaram de existir/aparecer no site (o navegador os remove). */
  missingIds: number[];
  subtotalCents: number;
  hasDemo: boolean;
  hasIssues: boolean;
}

export async function resolveCart(rawItems: unknown): Promise<CartResolution> {
  const items = sanitizeCartInput(rawItems);
  if (items.length === 0) return { lines: [], missingIds: [], subtotalCents: 0, hasDemo: false, hasIssues: false };

  const config = await getStoreSettings();
  const byId = await loadStoreProducts(getDb(), items.map((i) => i.id), config);

  const lines: CartLine[] = [];
  const missingIds: number[] = [];
  for (const item of items) {
    const product = byId.get(item.id);
    if (!product) {
      missingIds.push(item.id);
      continue;
    }
    const sellable = product.state !== 'CONSULT' && product.priceCents !== null;
    const issue: CartIssue | null = !sellable ? 'UNAVAILABLE' : product.available <= 0 ? 'OUT_OF_STOCK' : item.qty > product.available ? 'INSUFFICIENT' : null;
    const unitPriceCents = product.priceCents ?? 0;
    lines.push({
      productId: product.id,
      name: product.name,
      unit: product.unit,
      iconKey: product.iconKey,
      imageFileId: product.imageFileId,
      href: product.href,
      unitPriceCents,
      isDemoPrice: product.isDemoPrice,
      quantity: item.qty,
      available: product.available,
      lineTotalCents: issue === 'UNAVAILABLE' || issue === 'OUT_OF_STOCK' ? 0 : unitPriceCents * item.qty,
      issue,
    });
  }
  return {
    lines,
    missingIds,
    subtotalCents: lines.reduce((sum, line) => sum + line.lineTotalCents, 0),
    hasDemo: lines.some((line) => line.isDemoPrice),
    hasIssues: lines.some((line) => line.issue !== null),
  };
}

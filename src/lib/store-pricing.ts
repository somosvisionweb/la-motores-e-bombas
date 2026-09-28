/**
 * Regras de preço e disponibilidade de um produto na loja virtual (funções puras).
 *
 * - Preço real (`salePriceCents` > 0) sempre vale. Sem preço real, o preço de DEMONSTRAÇÃO (fictício) é usado,
 *   se existir; sem nenhum dos dois, o produto aparece como "consultar valor" (nenhum preço é inventado).
 * - Produto com preço de demonstração tem estoque de demonstração e gera pedidos de demonstração.
 */
import type { Tone } from '@/config/order-status';
import { DEMO_STORE_STOCK, LOW_STOCK_NOTICE } from '@/config/store';
import { slugify } from './text';

export type StoreProductState = 'AVAILABLE' | 'LAST_UNITS' | 'OUT_OF_STOCK' | 'CONSULT';

export interface PricingInput {
  salePriceCents: number;
  demoPriceCents: number | null;
  stock: number;
  sellOnline: boolean;
}

export interface Pricing {
  priceCents: number | null;
  isDemoPrice: boolean;
  /** Quantidade que pode ser comprada agora. */
  available: number;
  /** Pode ser colocado no carrinho. */
  purchasable: boolean;
  state: StoreProductState;
}

export function computeStorePricing(input: PricingInput, storeEnabled = true): Pricing {
  const hasRealPrice = input.salePriceCents > 0;
  const hasDemoPrice = !hasRealPrice && (input.demoPriceCents ?? 0) > 0;
  const priceCents = hasRealPrice ? input.salePriceCents : hasDemoPrice ? input.demoPriceCents! : null;
  const isDemoPrice = hasDemoPrice;
  const available = priceCents === null ? 0 : isDemoPrice ? DEMO_STORE_STOCK : Math.max(0, input.stock);

  if (!storeEnabled || !input.sellOnline || priceCents === null) {
    return { priceCents, isDemoPrice, available, purchasable: false, state: 'CONSULT' };
  }
  if (available <= 0) return { priceCents, isDemoPrice, available: 0, purchasable: false, state: 'OUT_OF_STOCK' };
  const state: StoreProductState = !isDemoPrice && available <= LOW_STOCK_NOTICE ? 'LAST_UNITS' : 'AVAILABLE';
  return { priceCents, isDemoPrice, available, purchasable: true, state };
}

// ---------------------------------------------------------------------------
// Situação do produto na loja (visão da equipe)
// ---------------------------------------------------------------------------

export const STORE_LISTING_KEYS = ['ON_SALE', 'OUT_OF_STOCK', 'NO_PRICE', 'CONSULT_ONLY', 'HIDDEN'] as const;
export type StoreListingStatus = (typeof STORE_LISTING_KEYS)[number];

export const STORE_LISTING_STATUS: Record<StoreListingStatus, { label: string; tone: Tone; hint: string }> = {
  ON_SALE: { label: 'À venda', tone: 'green', hint: 'Aparece na loja e pode ser comprado.' },
  OUT_OF_STOCK: { label: 'Sem estoque', tone: 'amber', hint: 'Tem preço, mas o estoque está zerado: a loja mostra "esgotado".' },
  NO_PRICE: { label: 'Sem preço', tone: 'red', hint: 'Falta o preço de venda: a loja mostra "valor sob consulta".' },
  CONSULT_ONLY: { label: 'Só consulta', tone: 'slate', hint: '"Vender na loja virtual" está desmarcado: o cliente só consulta pelo WhatsApp.' },
  HIDDEN: { label: 'Oculto', tone: 'slate', hint: 'Produto inativo ou não marcado para aparecer no site.' },
};

/** Situação REAL do produto (preço de demonstração não conta): o que a equipe precisa fazer para vendê-lo. */
export function storeListingStatus(product: { isActive: boolean; showOnSite: boolean; sellOnline: boolean; salePriceCents: number; stock: number }): StoreListingStatus {
  if (!product.isActive || !product.showOnSite) return 'HIDDEN';
  if (!product.sellOnline) return 'CONSULT_ONLY';
  if (product.salePriceCents <= 0) return 'NO_PRICE';
  if (product.stock <= 0) return 'OUT_OF_STOCK';
  return 'ON_SALE';
}

/** Endereço público do produto: `/loja/produto/12-rolamentos`. */
export function productPath(id: number, name: string): string {
  const slug = slugify(name).slice(0, 60);
  return slug ? `/loja/produto/${id}-${slug}` : `/loja/produto/${id}`;
}

/** Extrai o id do parâmetro da rota (`12-rolamentos` → 12). */
export function parseProductParam(param: string): number | null {
  const match = /^(\d{1,9})(?:-.*)?$/.exec(param);
  if (!match) return null;
  const id = Number(match[1]);
  return Number.isSafeInteger(id) && id > 0 ? id : null;
}

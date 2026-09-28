import { CART_MAX_LINES, CART_MAX_QTY } from '@/config/store';

/** Uma linha do carrinho guardada no navegador: só o produto e a quantidade (preço e estoque vêm do servidor). */
export interface CartInputLine {
  id: number;
  qty: number;
}

/** Normaliza o que veio do navegador: ids/quantidades inteiros, sem repetição, dentro dos limites. */
export function sanitizeCartInput(raw: unknown): CartInputLine[] {
  if (!Array.isArray(raw)) return [];
  const merged = new Map<number, number>();
  for (const entry of raw) {
    if (typeof entry !== 'object' || entry === null) continue;
    const id = Number((entry as { id?: unknown }).id);
    const qty = Number((entry as { qty?: unknown }).qty);
    if (!Number.isSafeInteger(id) || id <= 0 || !Number.isFinite(qty)) continue;
    const quantity = Math.min(CART_MAX_QTY, Math.max(1, Math.floor(qty)));
    if (!merged.has(id) && merged.size >= CART_MAX_LINES) continue;
    merged.set(id, Math.min(CART_MAX_QTY, (merged.get(id) ?? 0) + quantity));
  }
  return [...merged].map(([id, qty]) => ({ id, qty }));
}

/** Lê o carrinho enviado em um campo de formulário (JSON). Entrada inválida vira carrinho vazio. */
export function parseCartField(value: FormDataEntryValue | string | null | undefined): CartInputLine[] {
  if (typeof value !== 'string' || value.length > 4000) return [];
  try {
    return sanitizeCartInput(JSON.parse(value));
  } catch {
    return [];
  }
}

import { normalizeSearch, onlyDigits } from '@/lib/text';

/**
 * Textos normalizados (minúsculos, sem acento) gravados em `search_text`.
 * As buscas usam LIKE sobre esta coluna, então "joao" encontra "João".
 */
export function customerSearchText(c: {
  name: string;
  phone?: string | null;
  whatsapp?: string | null;
  document?: string | null;
  email?: string | null;
}): string {
  return normalizeSearch(
    [c.name, onlyDigits(c.phone), onlyDigits(c.whatsapp), onlyDigits(c.document), c.email].filter(Boolean).join(' '),
  );
}

export function serviceSearchText(s: { name: string; category?: string | null; description?: string | null }): string {
  return normalizeSearch([s.name, s.category, s.description].filter(Boolean).join(' '));
}

export function productSearchText(p: { name: string; code?: string | null; category?: string | null }): string {
  return normalizeSearch([p.name, p.code, p.category].filter(Boolean).join(' '));
}

export function orderSearchText(o: {
  code: string;
  customerName: string;
  customerPhone?: string | null;
  equipment: string;
  brand?: string | null;
  model?: string | null;
}): string {
  return normalizeSearch(
    [o.code, o.customerName, onlyDigits(o.customerPhone), o.equipment, o.brand, o.model].filter(Boolean).join(' '),
  );
}

export function saleSearchText(s: { code: string; customerName?: string | null; notes?: string | null }): string {
  return normalizeSearch([s.code, s.customerName ?? 'consumidor final', s.notes].filter(Boolean).join(' '));
}

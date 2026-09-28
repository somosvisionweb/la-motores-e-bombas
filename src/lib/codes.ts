/** Códigos legíveis exibidos ao usuário. Os números são sequenciais e vêm do banco. */
export function formatOrderCode(number: number): string {
  return `OS-${String(number).padStart(6, '0')}`;
}

export function formatSaleCode(number: number): string {
  return `VD-${String(number).padStart(6, '0')}`;
}

/** Pedido da loja virtual (ex.: LJ-000012). */
export function formatStoreOrderCode(number: number): string {
  return `LJ-${String(number).padStart(6, '0')}`;
}

export function formatReceiptCode(paymentId: number): string {
  return `REC-${String(paymentId).padStart(6, '0')}`;
}

export function formatProductCode(sequence: number): string {
  return `PRD-${String(sequence).padStart(4, '0')}`;
}

/**
 * Interpreta uma busca como código de OS: "OS-000123", "os123", "#123" ou "123".
 * Retorna o número da OS ou null.
 */
export function parseOrderCode(query: string): number | null {
  const match = /^\s*(?:os)?[\s#-]*0*(\d{1,9})\s*$/i.exec(query);
  if (!match) return null;
  const n = Number(match[1]);
  return Number.isSafeInteger(n) && n > 0 ? n : null;
}

export function parseStoreOrderCode(query: string): number | null {
  const match = /^\s*(?:lj|loja|pedido)[\s#-]*0*(\d{1,9})\s*$/i.exec(query);
  if (!match) return null;
  const n = Number(match[1]);
  return Number.isSafeInteger(n) && n > 0 ? n : null;
}

export function parseSaleCode(query: string): number | null {
  const match = /^\s*(?:vd|venda)[\s#-]*0*(\d{1,9})\s*$/i.exec(query);
  if (!match) return null;
  const n = Number(match[1]);
  return Number.isSafeInteger(n) && n > 0 ? n : null;
}

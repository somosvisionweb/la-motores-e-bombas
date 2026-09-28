/**
 * Valores monetários são SEMPRE inteiros em centavos (evita erros de ponto flutuante).
 */
const brl = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' });
const decimal = new Intl.NumberFormat('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

/** "R$ 1.234,56" (espaço comum, não "non-breaking"; use `white-space: nowrap` no CSS). */
export function formatBRL(cents: number | null | undefined): string {
  return brl.format((cents ?? 0) / 100).replace(/ /g, ' ');
}

/** "1.234,56" (sem o símbolo da moeda). */
export function formatDecimalBR(cents: number | null | undefined): string {
  return decimal.format((cents ?? 0) / 100);
}

/**
 * Converte texto digitado ("R$ 1.234,56", "1234,5", "1234.56", "1.234") para centavos.
 * Retorna null se não for possível interpretar.
 */
export function parseBRLToCents(input: string | number | null | undefined): number | null {
  if (input === null || input === undefined) return null;
  if (typeof input === 'number') return Number.isFinite(input) ? Math.round(input * 100) : null;

  let text = input.replace(/R\$|\s/g, '').trim();
  if (!text) return null;

  let negative = false;
  if (text.startsWith('-')) {
    negative = true;
    text = text.slice(1);
  }
  if (!/^[\d.,]+$/.test(text)) return null;

  let intPart: string;
  let fracPart = '';
  const lastComma = text.lastIndexOf(',');
  const lastDot = text.lastIndexOf('.');

  if (lastComma !== -1) {
    // formato brasileiro: vírgula decimal, pontos de milhar
    intPart = text.slice(0, lastComma).replace(/[.,]/g, '');
    fracPart = text.slice(lastComma + 1).replace(/[.,]/g, '');
  } else if (lastDot !== -1 && text.length - lastDot - 1 <= 2 && text.indexOf('.') === lastDot) {
    // "1234.5" / "1234.56" (ponto decimal)
    intPart = text.slice(0, lastDot);
    fracPart = text.slice(lastDot + 1);
  } else {
    intPart = text.replace(/\./g, '');
  }

  if (!/^\d*$/.test(intPart) || !/^\d*$/.test(fracPart)) return null;
  const cents = Number(intPart || '0') * 100 + Number((fracPart + '00').slice(0, 2));
  if (!Number.isSafeInteger(cents)) return null;
  return negative ? -cents : cents;
}

/** Soma segura de itens: quantidade × preço unitário (ambos inteiros). */
export function lineTotal(quantity: number, unitPriceCents: number): number {
  return Math.round(quantity * unitPriceCents);
}

/** Percentual (0–100) com uma casa decimal; 0 quando o total é zero. */
export function percentOf(part: number, total: number): number {
  if (!total) return 0;
  return Math.round((part / total) * 1000) / 10;
}

export function formatPercent(value: number): string {
  return `${new Intl.NumberFormat('pt-BR', { maximumFractionDigits: 1 }).format(value)}%`;
}

export function formatInt(value: number | null | undefined): string {
  return new Intl.NumberFormat('pt-BR').format(value ?? 0);
}

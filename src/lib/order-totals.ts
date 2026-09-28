import { lineTotal } from './money';

export interface TotalsItem {
  kind: 'SERVICE' | 'PART';
  quantity: number;
  unitPriceCents: number;
}

export interface OrderTotals {
  /** Soma das peças/produtos. */
  partsTotalCents: number;
  /** Soma dos serviços (mão de obra). */
  laborTotalCents: number;
  subtotalCents: number;
  /** Desconto efetivamente aplicado (nunca maior que o subtotal). */
  discountCents: number;
  totalCents: number;
}

/** Cálculo único de totais (usado no servidor, no formulário e nos documentos). */
export function computeOrderTotals(items: TotalsItem[], discountCents = 0): OrderTotals {
  let parts = 0;
  let labor = 0;
  for (const item of items) {
    const total = lineTotal(item.quantity, item.unitPriceCents);
    if (item.kind === 'PART') parts += total;
    else labor += total;
  }
  const subtotal = parts + labor;
  const discount = Math.min(Math.max(0, Math.round(discountCents)), subtotal);
  return {
    partsTotalCents: parts,
    laborTotalCents: labor,
    subtotalCents: subtotal,
    discountCents: discount,
    totalCents: subtotal - discount,
  };
}

/** Situação de pagamento a partir do total e do já recebido. */
export function paymentSummary(totalCents: number, paidCents: number) {
  const balanceCents = Math.max(0, totalCents - paidCents);
  const state = totalCents <= 0 ? 'NONE' : paidCents >= totalCents ? 'PAID' : paidCents > 0 ? 'PARTIAL' : 'PENDING';
  return { paidCents, balanceCents, state } as const;
}

export const PAYMENT_METHOD_KEYS = ['DINHEIRO', 'PIX', 'CARTAO', 'BOLETO'] as const;
export type PaymentMethod = (typeof PAYMENT_METHOD_KEYS)[number];

export const PAYMENT_METHOD_LABEL: Record<PaymentMethod, string> = {
  DINHEIRO: 'Dinheiro',
  PIX: 'PIX',
  CARTAO: 'Cartão',
  BOLETO: 'Boleto bancário',
};

/** Rótulos curtos para gráficos e tabelas compactas. */
export const PAYMENT_METHOD_SHORT: Record<PaymentMethod, string> = {
  DINHEIRO: 'Dinheiro',
  PIX: 'PIX',
  CARTAO: 'Cartão',
  BOLETO: 'Boleto',
};

export function isPaymentMethod(value: unknown): value is PaymentMethod {
  return typeof value === 'string' && (PAYMENT_METHOD_KEYS as readonly string[]).includes(value);
}

export const ITEM_KIND_KEYS = ['SERVICE', 'PART'] as const;
export type ItemKind = (typeof ITEM_KIND_KEYS)[number];
export const ITEM_KIND_LABEL: Record<ItemKind, string> = {
  SERVICE: 'Serviço',
  PART: 'Peça / produto',
};

export const STOCK_REASON_KEYS = ['INITIAL', 'PURCHASE', 'ORDER', 'SALE', 'ADJUSTMENT', 'RETURN'] as const;
export type StockReason = (typeof STOCK_REASON_KEYS)[number];
export const STOCK_REASON_LABEL: Record<StockReason, string> = {
  INITIAL: 'Estoque inicial',
  PURCHASE: 'Entrada / compra',
  ORDER: 'Uso em ordem de serviço',
  SALE: 'Venda',
  ADJUSTMENT: 'Ajuste manual',
  RETURN: 'Devolução',
};

/**
 * Loja virtual: status dos pedidos, formas de recebimento/pagamento e limites.
 * Fonte única para chaves, rótulos, cores (tons do design system) e regras de fluxo.
 */
import type { Tone } from './order-status';

export const STORE_ORDER_STATUS_KEYS = ['RECEIVED', 'CONFIRMED', 'READY', 'OUT_FOR_DELIVERY', 'COMPLETED', 'CANCELED'] as const;
export type StoreOrderStatus = (typeof STORE_ORDER_STATUS_KEYS)[number];

export const FULFILLMENT_KEYS = ['PICKUP', 'DELIVERY'] as const;
export type Fulfillment = (typeof FULFILLMENT_KEYS)[number];
export const FULFILLMENT_LABEL: Record<Fulfillment, string> = {
  PICKUP: 'Retirada na loja',
  DELIVERY: 'Entrega',
};

/** PIX = paga agora por QR Code/copia e cola; ON_SITE = paga na retirada (ou na entrega). */
export const STORE_PAYMENT_KEYS = ['PIX', 'ON_SITE'] as const;
export type StorePaymentMethod = (typeof STORE_PAYMENT_KEYS)[number];

export function storePaymentLabel(method: StorePaymentMethod, fulfillment: Fulfillment): string {
  if (method === 'PIX') return 'PIX';
  return fulfillment === 'DELIVERY' ? 'Pagar na entrega' : 'Pagar na retirada';
}

interface StatusMeta {
  label: string;
  tone: Tone;
  /** Descrição curta exibida ao cliente e no histórico. */
  hint: string;
}

export const STORE_ORDER_STATUS: Record<StoreOrderStatus, StatusMeta> = {
  RECEIVED: { label: 'Recebido', tone: 'amber', hint: 'Pedido recebido, aguardando a confirmação da loja.' },
  CONFIRMED: { label: 'Confirmado', tone: 'blue', hint: 'Pedido confirmado. Estamos separando os produtos.' },
  READY: { label: 'Pronto', tone: 'teal', hint: 'Pedido separado e pronto.' },
  OUT_FOR_DELIVERY: { label: 'Saiu para entrega', tone: 'cyan', hint: 'O pedido saiu para entrega.' },
  COMPLETED: { label: 'Concluído', tone: 'green', hint: 'Pedido retirado ou entregue.' },
  CANCELED: { label: 'Cancelado', tone: 'red', hint: 'Pedido cancelado.' },
};

/** Rótulo mostrado ao cliente (o status "Pronto" muda conforme o modo de recebimento). */
export function customerStatusLabel(status: StoreOrderStatus, fulfillment: Fulfillment): string {
  if (status === 'READY') return fulfillment === 'DELIVERY' ? 'Pronto para entrega' : 'Pronto para retirada';
  if (status === 'COMPLETED') return fulfillment === 'DELIVERY' ? 'Entregue' : 'Retirado';
  return STORE_ORDER_STATUS[status].label;
}

/** Etapas do fluxo normal, na ordem em que acontecem. */
export function storeFlow(fulfillment: Fulfillment): StoreOrderStatus[] {
  return fulfillment === 'DELIVERY'
    ? ['RECEIVED', 'CONFIRMED', 'READY', 'OUT_FOR_DELIVERY', 'COMPLETED']
    : ['RECEIVED', 'CONFIRMED', 'READY', 'COMPLETED'];
}

export function isFinalStoreStatus(status: StoreOrderStatus): boolean {
  return status === 'COMPLETED' || status === 'CANCELED';
}

/** Próximas etapas permitidas (só avança; o cancelamento é uma ação à parte). */
export function allowedNextStatuses(status: StoreOrderStatus, fulfillment: Fulfillment): StoreOrderStatus[] {
  if (isFinalStoreStatus(status)) return [];
  const flow = storeFlow(fulfillment);
  const index = flow.indexOf(status);
  if (index === -1) return [];
  return flow.slice(index + 1);
}

/** Mensagem exibida ao cliente na linha do tempo quando o pedido chega a um status. */
export function customerStatusMessage(status: StoreOrderStatus, fulfillment: Fulfillment): string {
  switch (status) {
    case 'RECEIVED':
      return 'Pedido recebido.';
    case 'CONFIRMED':
      return 'Pedido confirmado. Estamos separando os produtos.';
    case 'READY':
      return fulfillment === 'DELIVERY' ? 'Pedido pronto para entrega.' : 'Pedido pronto para retirada na loja.';
    case 'OUT_FOR_DELIVERY':
      return 'Seu pedido saiu para entrega.';
    case 'COMPLETED':
      return fulfillment === 'DELIVERY' ? 'Pedido entregue. Obrigado pela compra!' : 'Pedido retirado. Obrigado pela compra!';
    case 'CANCELED':
      return 'Pedido cancelado.';
  }
}

export interface DeliveryAddress {
  zip: string;
  street: string;
  number: string;
  complement: string | null;
  district: string;
  city: string;
  state: string;
}

// ---------- PIX ----------

export const PIX_KEY_TYPES = ['CPF', 'CNPJ', 'PHONE', 'EMAIL', 'RANDOM'] as const;
export type PixKeyType = (typeof PIX_KEY_TYPES)[number];
export const PIX_KEY_TYPE_LABEL: Record<PixKeyType, string> = {
  CPF: 'CPF',
  CNPJ: 'CNPJ',
  PHONE: 'Telefone',
  EMAIL: 'E-mail',
  RANDOM: 'Chave aleatória',
};

/**
 * Chave usada SOMENTE em pedidos de demonstração: o domínio ".invalid" é reservado (RFC 2606) e nunca existe,
 * então o banco recusa o código e ninguém consegue pagar por engano.
 */
export const DEMO_PIX_KEY = 'demonstracao@loja.invalid';

// ---------- Limites ----------

export const CART_MAX_LINES = 30;
export const CART_MAX_QTY = 99;
/** Estoque "fictício" dos produtos com preço de demonstração (pedidos de demonstração nunca mexem no estoque real). */
export const DEMO_STORE_STOCK = 20;
/** Máximo de pedidos por IP em uma hora (proteção contra abuso do checkout público). */
export const ORDERS_PER_IP_PER_HOUR = 8;
/** Teto geral por hora quando o IP de origem é desconhecido (servidor exposto sem proxy reverso). */
export const ORDERS_UNKNOWN_IP_PER_HOUR = 60;
/** Máximo de pedidos "aguardando" por telefone. */
export const OPEN_ORDERS_PER_PHONE = 3;
/** Quando "Últimas unidades" é exibido (somente estoque real). */
export const LOW_STOCK_NOTICE = 5;

export const STORE_DEFAULTS = {
  enabled: true,
  pixKey: null as string | null,
  pixKeyType: null as PixKeyType | null,
  deliveryEnabled: false,
  deliveryFeeCents: 0,
  freeDeliveryMinCents: null as number | null,
  deliveryNote: null as string | null,
  pickupNote: null as string | null,
  minOrderCents: 0,
  holdHours: 24,
  policyText: null as string | null,
};

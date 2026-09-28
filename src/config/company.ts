import type { PaymentMethod } from './payment-methods';

/** Tipos das configurações da empresa que ficam em colunas JSON. */
export const WEEKDAY_KEYS = ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'] as const;
export type WeekdayKey = (typeof WEEKDAY_KEYS)[number];

export const WEEKDAY_LABEL: Record<WeekdayKey, string> = {
  mon: 'Segunda-feira',
  tue: 'Terça-feira',
  wed: 'Quarta-feira',
  thu: 'Quinta-feira',
  fri: 'Sexta-feira',
  sat: 'Sábado',
  sun: 'Domingo',
};

export const WEEKDAY_SHORT: Record<WeekdayKey, string> = {
  mon: 'Segunda',
  tue: 'Terça',
  wed: 'Quarta',
  thu: 'Quinta',
  fri: 'Sexta',
  sat: 'Sábado',
  sun: 'Domingo',
};

export interface DaySchedule {
  closed: boolean;
  /** "08:00" */
  open: string | null;
  /** "17:00" */
  close: string | null;
}

export type BusinessHours = Record<WeekdayKey, DaySchedule>;

export interface WhatsAppTemplates {
  /** Contato geral (rodapé, contato). */
  general: string;
  /** Botão "Solicitar atendimento". */
  attendance: string;
  /** Pedido de orçamento. */
  quote: string;
  /** Atendimento a domicílio. */
  homeVisit: string;
  /** Envio de OS/recibo ao cliente. Placeholders: {{nome}}, {{empresa}}, {{codigo}}, {{link}}. */
  orderShare: string;
  /** Aviso ao comprador sobre um pedido da loja virtual. Mesmas variáveis; {{link}} é o acompanhamento do pedido. */
  storeOrder?: string;
}

export const WHATSAPP_TEMPLATE_PLACEHOLDERS = ['{{nome}}', '{{empresa}}', '{{codigo}}', '{{link}}'] as const;

export type AcceptedPaymentMethods = PaymentMethod[];

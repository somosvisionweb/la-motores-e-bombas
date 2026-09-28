/**
 * Status da Ordem de Serviço.
 * Fonte única para chaves, rótulos, cores (tons do design system) e regras de fluxo.
 */
export const ORDER_STATUS_KEYS = [
  'AGUARDANDO_AVALIACAO',
  'EM_ANALISE',
  'ORCAMENTO_ENVIADO',
  'AGUARDANDO_APROVACAO',
  'EM_MANUTENCAO',
  'AGUARDANDO_PECA',
  'PRONTO',
  'ENTREGUE',
  'CANCELADO',
] as const;

export type OrderStatus = (typeof ORDER_STATUS_KEYS)[number];

/** Tons disponíveis no design system (classes `.badge--tone-*`). */
export type Tone = 'slate' | 'blue' | 'violet' | 'amber' | 'cyan' | 'orange' | 'teal' | 'green' | 'red';

interface StatusMeta {
  label: string;
  tone: Tone;
  /** Descrição curta usada em dicas e no histórico. */
  hint: string;
}

export const ORDER_STATUS: Record<OrderStatus, StatusMeta> = {
  AGUARDANDO_AVALIACAO: { label: 'Aguardando avaliação', tone: 'slate', hint: 'Equipamento recebido, aguardando avaliação técnica.' },
  EM_ANALISE: { label: 'Em análise', tone: 'blue', hint: 'Técnico analisando o defeito.' },
  ORCAMENTO_ENVIADO: { label: 'Orçamento enviado', tone: 'violet', hint: 'Orçamento entregue ao cliente.' },
  AGUARDANDO_APROVACAO: { label: 'Aguardando aprovação', tone: 'amber', hint: 'Cliente ainda não aprovou o orçamento.' },
  EM_MANUTENCAO: { label: 'Em manutenção', tone: 'cyan', hint: 'Serviço em execução.' },
  AGUARDANDO_PECA: { label: 'Aguardando peça', tone: 'orange', hint: 'Serviço parado até a chegada de uma peça.' },
  PRONTO: { label: 'Pronto', tone: 'teal', hint: 'Serviço concluído, aguardando retirada.' },
  ENTREGUE: { label: 'Entregue', tone: 'green', hint: 'Equipamento entregue ao cliente.' },
  CANCELADO: { label: 'Cancelado', tone: 'red', hint: 'Ordem cancelada.' },
};

/** Etapas do fluxo principal, na ordem em que acontecem (usado no acompanhamento visual). */
export const ORDER_FLOW: OrderStatus[] = [
  'AGUARDANDO_AVALIACAO',
  'EM_ANALISE',
  'ORCAMENTO_ENVIADO',
  'AGUARDANDO_APROVACAO',
  'EM_MANUTENCAO',
  'PRONTO',
  'ENTREGUE',
];

/** Status em que a OS ainda está "aberta" (em andamento). */
export const OPEN_ORDER_STATUSES: OrderStatus[] = [
  'AGUARDANDO_AVALIACAO',
  'EM_ANALISE',
  'ORCAMENTO_ENVIADO',
  'AGUARDANDO_APROVACAO',
  'EM_MANUTENCAO',
  'AGUARDANDO_PECA',
  'PRONTO',
];

/** Status em que o serviço já foi executado. */
export const COMPLETED_ORDER_STATUSES: OrderStatus[] = ['PRONTO', 'ENTREGUE'];

/** Status em que a OS está em execução/andamento operacional (dashboard "serviços em andamento"). */
export const IN_PROGRESS_ORDER_STATUSES: OrderStatus[] = [
  'AGUARDANDO_AVALIACAO',
  'EM_ANALISE',
  'ORCAMENTO_ENVIADO',
  'AGUARDANDO_APROVACAO',
  'EM_MANUTENCAO',
  'AGUARDANDO_PECA',
];

export function isOrderStatus(value: unknown): value is OrderStatus {
  return typeof value === 'string' && (ORDER_STATUS_KEYS as readonly string[]).includes(value);
}

export function isOpenStatus(status: OrderStatus): boolean {
  return OPEN_ORDER_STATUSES.includes(status);
}

/** Próxima etapa sugerida no fluxo (null quando não há). */
export function nextSuggestedStatus(status: OrderStatus): OrderStatus | null {
  if (status === 'AGUARDANDO_PECA') return 'EM_MANUTENCAO';
  const index = ORDER_FLOW.indexOf(status);
  if (index === -1 || index === ORDER_FLOW.length - 1) return null;
  return ORDER_FLOW[index + 1] ?? null;
}

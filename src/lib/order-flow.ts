import type { OrderStatus } from '@/config/order-status';
import type { ISODate } from './dates';

export interface OrderDates {
  completedDate: ISODate | null;
  deliveredDate: ISODate | null;
}

/**
 * Efeitos de uma mudança de status sobre as datas da OS:
 *  - Pronto/Entregue → registra a data de conclusão do serviço (se ainda não houver);
 *  - Entregue → registra a data de entrega (se ainda não houver);
 *  - voltar para uma etapa anterior → limpa as datas de conclusão/entrega (o serviço deixou de estar concluído).
 * Cancelar não altera as datas.
 */
export function statusChangeDates(to: OrderStatus, current: OrderDates, today: ISODate): OrderDates {
  if (to === 'CANCELADO') return { ...current };
  if (to === 'ENTREGUE') return { completedDate: current.completedDate ?? today, deliveredDate: current.deliveredDate ?? today };
  if (to === 'PRONTO') return { completedDate: current.completedDate ?? today, deliveredDate: null };
  return { completedDate: null, deliveredDate: null };
}

/** Status a partir dos quais uma OS pode ser reaberta. */
export function canReopen(status: OrderStatus): boolean {
  return status === 'CANCELADO';
}

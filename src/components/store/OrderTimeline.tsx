import { Check, X } from 'lucide-react';
import { customerStatusLabel, storeFlow, type Fulfillment, type StoreOrderStatus } from '@/config/store';
import { formatDateTimeBR } from '@/lib/dates';

/** Etapas do pedido para o cliente: o que já aconteceu, onde está agora e o que falta. */
export function OrderTimeline({
  status,
  fulfillment,
  moments,
  timezone,
}: {
  status: StoreOrderStatus;
  fulfillment: Fulfillment;
  /** Quando cada etapa aconteceu (quando conhecido). */
  moments: Partial<Record<StoreOrderStatus, Date | null>>;
  timezone: string;
}) {
  if (status === 'CANCELED') {
    return (
      <div className="order-canceled" role="status">
        <span>
          <X aria-hidden="true" />
        </span>
        <div>
          <strong>Pedido cancelado</strong>
          {moments.CANCELED ? <p>{formatDateTimeBR(moments.CANCELED, timezone)}</p> : null}
        </div>
      </div>
    );
  }

  const flow = storeFlow(fulfillment);
  const currentIndex = flow.indexOf(status);
  return (
    <ol className="order-steps" aria-label="Andamento do pedido">
      {flow.map((step, index) => {
        const state = index < currentIndex || status === 'COMPLETED' ? 'done' : index === currentIndex ? 'current' : 'todo';
        const when = moments[step];
        return (
          <li key={step} className={`order-step order-step--${state}`} aria-current={state === 'current' ? 'step' : undefined}>
            <span className="order-step__dot">{state === 'done' ? <Check aria-hidden="true" /> : index + 1}</span>
            <span className="order-step__label">{customerStatusLabel(step, fulfillment)}</span>
            {when && state !== 'todo' ? <span className="order-step__time">{formatDateTimeBR(when, timezone)}</span> : null}
          </li>
        );
      })}
    </ol>
  );
}

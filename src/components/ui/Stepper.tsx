import { Check } from 'lucide-react';
import { ORDER_FLOW, ORDER_STATUS, type OrderStatus } from '@/config/order-status';
import { cn } from '@/lib/cn';

/** Acompanhamento visual do fluxo da OS (aguardando peça é tratado como "em manutenção"). */
export function OrderStepper({ status }: { status: OrderStatus }) {
  if (status === 'CANCELADO') return null;
  const effective: OrderStatus = status === 'AGUARDANDO_PECA' ? 'EM_MANUTENCAO' : status;
  const currentIndex = ORDER_FLOW.indexOf(effective);

  return (
    <ol className="stepper" aria-label="Andamento da ordem de serviço">
      {ORDER_FLOW.map((step, index) => {
        const state = index < currentIndex || status === 'ENTREGUE' ? 'done' : index === currentIndex ? 'current' : 'todo';
        const label = step === 'EM_MANUTENCAO' && status === 'AGUARDANDO_PECA' ? ORDER_STATUS.AGUARDANDO_PECA.label : ORDER_STATUS[step].label;
        return (
          <li
            key={step}
            className={cn('stepper__step', state === 'done' && 'stepper__step--done', state === 'current' && 'stepper__step--current')}
            aria-current={state === 'current' ? 'step' : undefined}
          >
            <span className="stepper__dot">{state === 'done' ? <Check aria-hidden="true" strokeWidth={3} /> : index + 1}</span>
            <span className="stepper__label">{label}</span>
          </li>
        );
      })}
    </ol>
  );
}

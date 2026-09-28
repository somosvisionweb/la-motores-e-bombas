import { ORDER_STATUS, type OrderStatus, type Tone } from '@/config/order-status';
import { PAYMENT_METHOD_SHORT, type PaymentMethod } from '@/config/payment-methods';
import { cn } from '@/lib/cn';

export function Badge({
  tone = 'slate',
  dot = false,
  className,
  children,
  title,
}: {
  tone?: Tone;
  dot?: boolean;
  className?: string;
  children: React.ReactNode;
  title?: string;
}) {
  return (
    <span className={cn('badge', `badge--tone-${tone}`, dot && 'badge--dot', className)} title={title}>
      {children}
    </span>
  );
}

export function StatusBadge({ status }: { status: OrderStatus }) {
  const meta = ORDER_STATUS[status];
  return (
    <Badge tone={meta.tone} dot title={meta.hint}>
      {meta.label}
    </Badge>
  );
}

const METHOD_TONE: Record<PaymentMethod, Tone> = {
  PIX: 'teal',
  CARTAO: 'violet',
  DINHEIRO: 'green',
  BOLETO: 'amber',
};

export function MethodBadge({ method }: { method: PaymentMethod | null | undefined }) {
  if (!method) return <span className="text-subtle">—</span>;
  return <Badge tone={METHOD_TONE[method]}>{PAYMENT_METHOD_SHORT[method]}</Badge>;
}

export type PaymentState = 'PAID' | 'PARTIAL' | 'PENDING' | 'NONE';

/** Situação de pagamento a partir do total e do valor já recebido. */
export function paymentState(totalCents: number, paidCents: number): PaymentState {
  if (totalCents <= 0) return 'NONE';
  if (paidCents >= totalCents) return 'PAID';
  if (paidCents > 0) return 'PARTIAL';
  return 'PENDING';
}

export function PaymentStateBadge({ total, paid }: { total: number; paid: number }) {
  const state = paymentState(total, paid);
  if (state === 'NONE') return <span className="text-subtle">—</span>;
  const map = {
    PAID: { tone: 'green', label: 'Pago' },
    PARTIAL: { tone: 'amber', label: 'Parcial' },
    PENDING: { tone: 'red', label: 'Pendente' },
  } as const;
  const { tone, label } = map[state];
  return (
    <Badge tone={tone} dot>
      {label}
    </Badge>
  );
}

/** Selo de dados de demonstração (nunca misturar com dados reais). */
export function DemoBadge() {
  return (
    <span className="badge badge--demo" title="Registro fictício, criado apenas para demonstração">
      Demonstração
    </span>
  );
}

import { formatBRL } from '@/lib/money';
import { cn } from '@/lib/cn';

/** Valor em reais formatado; `tone="auto"` colore positivo (verde) / negativo (vermelho). */
export function Money({
  cents,
  tone,
  className,
}: {
  cents: number | null | undefined;
  tone?: 'auto' | 'positive' | 'negative' | 'muted';
  className?: string;
}) {
  const value = cents ?? 0;
  const resolved = tone === 'auto' ? (value > 0 ? 'positive' : value < 0 ? 'negative' : 'muted') : tone;
  return <span className={cn('money', resolved && `money--${resolved}`, className)}>{formatBRL(value)}</span>;
}

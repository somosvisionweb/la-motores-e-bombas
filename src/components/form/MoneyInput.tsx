'use client';

import { formatDecimalBR } from '@/lib/money';
import { cn } from '@/lib/cn';

/** Campo monetário controlado: digita-se apenas números (1 → 0,01). O valor é sempre em CENTAVOS. */
export function MoneyInput({
  cents,
  onChange,
  ariaLabel,
  id,
  className,
  invalid,
  disabled,
  nullable,
  placeholder,
  size,
}: {
  cents: number | null;
  onChange: (cents: number | null) => void;
  ariaLabel: string;
  id?: string;
  className?: string;
  invalid?: boolean;
  disabled?: boolean;
  nullable?: boolean;
  placeholder?: string;
  size?: 'sm';
}) {
  return (
    <div className={cn('input-group', className)}>
      <span className="input-group__addon" aria-hidden="true">
        R$
      </span>
      <input
        id={id}
        type="text"
        inputMode="numeric"
        autoComplete="off"
        aria-label={ariaLabel}
        className={cn('input tabular', size === 'sm' && 'input--sm')}
        value={cents === null ? '' : formatDecimalBR(cents)}
        placeholder={placeholder ?? (nullable ? 'a combinar' : '0,00')}
        disabled={disabled}
        aria-invalid={invalid ? true : undefined}
        onChange={(event) => {
          const digits = event.target.value.replace(/\D/g, '').slice(0, 11);
          onChange(digits ? Number(digits) : nullable ? null : 0);
        }}
        onFocus={(event) => event.currentTarget.select()}
      />
    </div>
  );
}

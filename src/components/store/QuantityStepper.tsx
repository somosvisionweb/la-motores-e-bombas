'use client';

import { Minus, Plus } from 'lucide-react';
import { useId, useState } from 'react';

/** Quantidade com botões − e + e digitação direta (o valor só muda quando é um número válido entre `min` e `max`). */
export function QuantityStepper({
  value,
  onChange,
  min = 1,
  max,
  label,
  size = 'md',
}: {
  value: number;
  onChange: (next: number) => void;
  min?: number;
  max: number;
  label: string;
  size?: 'sm' | 'md';
}) {
  const id = useId();
  const [draft, setDraft] = useState<string | null>(null);

  return (
    <div className={`qty qty--${size}`} role="group" aria-label={label}>
      <button type="button" className="qty__btn" onClick={() => onChange(Math.max(min, value - 1))} disabled={value <= min} aria-label="Diminuir quantidade" aria-controls={id}>
        <Minus aria-hidden="true" />
      </button>
      <input
        id={id}
        className="qty__input tabular"
        type="text"
        inputMode="numeric"
        autoComplete="off"
        value={draft ?? String(value)}
        aria-label={`${label} (máximo ${max})`}
        onChange={(event) => {
          const text = event.target.value.replace(/\D/g, '').slice(0, 3);
          setDraft(text);
          const parsed = Number(text);
          if (text !== '' && Number.isInteger(parsed) && parsed >= min) onChange(Math.min(max, parsed));
        }}
        onBlur={() => setDraft(null)}
        onFocus={(event) => event.currentTarget.select()}
      />
      <button type="button" className="qty__btn" onClick={() => onChange(Math.min(max, value + 1))} disabled={value >= max} aria-label="Aumentar quantidade" aria-controls={id}>
        <Plus aria-hidden="true" />
      </button>
    </div>
  );
}

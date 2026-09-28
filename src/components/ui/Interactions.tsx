'use client';

import { useState } from 'react';
import { Check, Copy, Printer } from 'lucide-react';
import { cn } from '@/lib/cn';
import { useToast } from './Toast';

/** Formulário GET que reenvia sozinho quando um select/checkbox muda (filtros de listagem). */
export function AutoSubmitForm({
  children,
  className,
  action,
}: {
  children: React.ReactNode;
  className?: string;
  action?: string;
}) {
  return (
    <form
      method="get"
      action={action}
      className={className}
      onChange={(event) => {
        const target = event.target as HTMLElement;
        if (target instanceof HTMLSelectElement || (target instanceof HTMLInputElement && (target.type === 'checkbox' || target.type === 'date'))) {
          event.currentTarget.requestSubmit();
        }
      }}
    >
      {children}
    </form>
  );
}

export function CopyButton({
  text,
  label = 'Copiar',
  className,
  size = 'sm',
}: {
  text: string;
  label?: string;
  className?: string;
  size?: 'sm' | 'md';
}) {
  const [copied, setCopied] = useState(false);
  const toast = useToast();
  return (
    <button
      type="button"
      className={cn('btn', size === 'sm' && 'btn--sm', className)}
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(text);
          setCopied(true);
          toast.success('Copiado para a área de transferência.');
          window.setTimeout(() => setCopied(false), 2000);
        } catch {
          toast.error('Não foi possível copiar. Selecione e copie manualmente.');
        }
      }}
    >
      {copied ? <Check aria-hidden="true" /> : <Copy aria-hidden="true" />}
      {copied ? 'Copiado' : label}
    </button>
  );
}

export function PrintButton({ label = 'Imprimir', className, variant = 'primary' }: { label?: string; className?: string; variant?: 'primary' | 'brand' | 'secondary' }) {
  return (
    <button
      type="button"
      className={cn('btn', variant !== 'secondary' && `btn--${variant}`, className)}
      onClick={() => window.print()}
    >
      <Printer aria-hidden="true" />
      {label}
    </button>
  );
}

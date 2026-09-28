'use client';

import { useFormStatus } from 'react-dom';
import { useFormState } from '@/components/form/ActionForm';
import { cn } from '@/lib/cn';

/** Botão de envio: desabilita e mostra "carregando" enquanto a ação do servidor executa. */
export function SubmitButton({
  children,
  pendingLabel,
  variant = 'primary',
  size,
  className,
  block,
  disabled,
  form,
}: {
  children: React.ReactNode;
  pendingLabel?: string;
  variant?: 'primary' | 'brand' | 'secondary' | 'danger' | 'danger-soft' | 'ghost';
  size?: 'sm' | 'lg';
  className?: string;
  block?: boolean;
  disabled?: boolean;
  form?: string;
}) {
  // `<ActionForm keepValues>` envia sem a `action` nativa do <form>: o useFormStatus não o enxerga, mas o ActionForm sabe.
  const { pending: nativePending } = useFormStatus();
  const { pending: actionPending } = useFormState();
  const pending = nativePending || actionPending;
  return (
    <button
      type="submit"
      form={form}
      className={cn(
        'btn',
        variant !== 'secondary' && `btn--${variant}`,
        size && `btn--${size}`,
        block && 'btn--block',
        className,
      )}
      disabled={pending || disabled}
      aria-busy={pending}
    >
      {pending ? <span className="spinner" aria-hidden="true" /> : null}
      {pending && pendingLabel ? pendingLabel : children}
    </button>
  );
}

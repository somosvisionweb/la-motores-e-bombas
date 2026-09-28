'use client';

import { useActionState, useState } from 'react';
import { initialActionState, type ActionState } from '@/lib/action-state';
import { cn } from '@/lib/cn';
import { Modal } from './Modal';
import { SubmitButton } from './SubmitButton';
import { useToast } from './Toast';

type Action = (state: ActionState, formData: FormData) => Promise<ActionState>;

/**
 * Botão que pede CONFIRMAÇÃO antes de executar uma ação do servidor (excluir, cancelar, estornar…).
 * O resultado (sucesso/erro) aparece como toast. Campos extras vão em `fields` (ex.: { id: '12' }).
 */
export function ConfirmActionForm({
  action,
  fields,
  title,
  message,
  confirmLabel = 'Confirmar',
  triggerLabel,
  triggerIcon,
  triggerVariant = 'danger-soft',
  triggerSize = 'sm',
  variant = 'danger',
  reasonLabel,
  reasonRequired,
  className,
  triggerClassName,
  iconOnly,
}: {
  action: Action;
  fields?: Record<string, string | number>;
  title: string;
  message: React.ReactNode;
  confirmLabel?: string;
  triggerLabel: string;
  triggerIcon?: React.ReactNode;
  triggerVariant?: 'danger-soft' | 'secondary' | 'ghost' | 'danger' | 'brand' | 'primary';
  triggerSize?: 'sm' | 'md';
  variant?: 'danger' | 'primary';
  /** Se informado, exibe um campo de motivo (enviado como "reason"). */
  reasonLabel?: string;
  reasonRequired?: boolean;
  className?: string;
  triggerClassName?: string;
  iconOnly?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const toast = useToast();
  // O resultado é tratado assim que a resposta chega (e não em um efeito): a linha pode sumir da tabela
  // logo em seguida (ex.: registro excluído) e o aviso ao usuário não pode se perder.
  const [, formAction] = useActionState(async (previous: ActionState, formData: FormData) => {
    const next = await action(previous, formData);
    if (next.message) {
      toast.toast(next.ok ? 'success' : 'error', next.message);
      setOpen(false);
    }
    return next;
  }, initialActionState);

  return (
    <form action={formAction} className={cn('cluster', className)} style={{ display: 'inline-flex' }}>
      {Object.entries(fields ?? {}).map(([name, value]) => (
        <input key={name} type="hidden" name={name} value={String(value)} />
      ))}
      <button
        type="button"
        className={cn('btn', triggerVariant !== 'secondary' && `btn--${triggerVariant}`, triggerSize === 'sm' && 'btn--sm', iconOnly && 'btn--icon', triggerClassName)}
        onClick={() => setOpen(true)}
        title={iconOnly ? triggerLabel : undefined}
        aria-label={iconOnly ? triggerLabel : undefined}
      >
        {triggerIcon}
        {iconOnly ? null : triggerLabel}
      </button>
      <Modal
        open={open}
        onClose={() => setOpen(false)}
        title={title}
        footer={
          <>
            <button type="button" className="btn" onClick={() => setOpen(false)}>
              Voltar
            </button>
            <SubmitButton variant={variant === 'danger' ? 'danger' : 'primary'} pendingLabel="Processando…">
              {confirmLabel}
            </SubmitButton>
          </>
        }
      >
        <div className="stack" style={{ ['--gap' as string]: '14px' }}>
          <div>{message}</div>
          {reasonLabel ? (
            <label className="field">
              <span className="field__label">
                {reasonLabel}
                {reasonRequired ? <span className="req">*</span> : null}
              </span>
              <textarea name="reason" className="textarea" rows={3} required={reasonRequired} maxLength={300} />
            </label>
          ) : null}
        </div>
      </Modal>
    </form>
  );
}

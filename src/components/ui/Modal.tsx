'use client';

import { useEffect, useRef } from 'react';
import { X } from 'lucide-react';
import { cn } from '@/lib/cn';

/** Modal acessível baseado no elemento nativo <dialog> (foco preso, Esc fecha, clique fora fecha). */
export function Modal({
  open,
  onClose,
  title,
  children,
  footer,
  size = 'md',
  labelledBy,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
  footer?: React.ReactNode;
  size?: 'md' | 'lg';
  labelledBy?: string;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  const titleId = labelledBy ?? `modal-title-${title.replace(/\W+/g, '-').toLowerCase()}`;

  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    if (open && !dialog.open) dialog.showModal();
    if (!open && dialog.open) dialog.close();
  }, [open]);

  return (
    <dialog
      ref={ref}
      className={cn('modal', size === 'lg' && 'modal--lg')}
      aria-labelledby={titleId}
      onClose={onClose}
      onClick={(event) => {
        if (event.target === ref.current) onClose();
      }}
    >
      <div className="modal__header">
        <h2 className="modal__title" id={titleId}>
          {title}
        </h2>
        <button type="button" className="btn btn--ghost btn--icon btn--sm modal__close" onClick={onClose} aria-label="Fechar">
          <X aria-hidden="true" />
        </button>
      </div>
      <div className="modal__body">{children}</div>
      {footer ? <div className="modal__footer">{footer}</div> : null}
    </dialog>
  );
}

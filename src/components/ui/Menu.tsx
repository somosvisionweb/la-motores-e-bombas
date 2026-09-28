'use client';

import { useEffect, useRef, useState } from 'react';
import { cn } from '@/lib/cn';

/**
 * Menu suspenso simples: fecha ao clicar fora, ao pressionar Esc ou ao escolher um item
 * (qualquer link/botão dentro do painel).
 */
export function Menu({
  trigger,
  children,
  align = 'right',
  triggerClassName,
  label,
  panelClassName,
  triggerVariant,
}: {
  trigger: React.ReactNode;
  children: React.ReactNode;
  align?: 'left' | 'right';
  triggerClassName?: string;
  label: string;
  panelClassName?: string;
  triggerVariant?: 'button' | 'plain';
}) {
  const [open, setOpen] = useState(false);
  const root = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onPointer = (event: MouseEvent) => {
      if (root.current && !root.current.contains(event.target as Node)) setOpen(false);
    };
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setOpen(false);
    };
    document.addEventListener('mousedown', onPointer);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onPointer);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  return (
    <div className="menu" ref={root}>
      <button
        type="button"
        className={cn(triggerVariant === 'plain' ? undefined : 'btn', triggerClassName)}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label={label}
        onClick={() => setOpen((v) => !v)}
      >
        {trigger}
      </button>
      {open ? (
        <div
          className={cn('menu__panel', align === 'left' && 'menu__panel--left', panelClassName)}
          role="menu"
          onClick={(event) => {
            // Adia o fechamento: remover o botão durante o clique cancelaria o envio de formulários (ex.: "Sair").
            if ((event.target as HTMLElement).closest('a, button, [data-menu-close]')) window.setTimeout(() => setOpen(false), 0);
          }}
        >
          {children}
        </div>
      ) : null}
    </div>
  );
}

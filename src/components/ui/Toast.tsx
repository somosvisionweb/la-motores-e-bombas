'use client';

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { CheckCircle2, Info, OctagonAlert, X } from 'lucide-react';

export type ToastKind = 'success' | 'error' | 'info';

interface ToastItem {
  id: number;
  kind: ToastKind;
  message: string;
}

interface ToastApi {
  toast: (kind: ToastKind, message: string) => void;
  success: (message: string) => void;
  error: (message: string) => void;
  info: (message: string) => void;
}

const ToastContext = createContext<ToastApi | null>(null);

const ICON = { success: CheckCircle2, error: OctagonAlert, info: Info } as const;

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [items, setItems] = useState<ToastItem[]>([]);
  const counter = useRef(0);

  const dismiss = useCallback((id: number) => setItems((list) => list.filter((t) => t.id !== id)), []);

  const toast = useCallback(
    (kind: ToastKind, message: string) => {
      const id = ++counter.current;
      setItems((list) => [...list.slice(-3), { id, kind, message }]);
      window.setTimeout(() => dismiss(id), kind === 'error' ? 8000 : 4500);
    },
    [dismiss],
  );

  const api = useMemo<ToastApi>(
    () => ({
      toast,
      success: (m) => toast('success', m),
      error: (m) => toast('error', m),
      info: (m) => toast('info', m),
    }),
    [toast],
  );

  return (
    <ToastContext value={api}>
      {children}
      <div className="toast-region" aria-live="polite" aria-atomic="false">
        {items.map((item) => {
          const Icon = ICON[item.kind];
          return (
            <div key={item.id} className={`toast toast--${item.kind}`} role={item.kind === 'error' ? 'alert' : 'status'}>
              <Icon aria-hidden="true" />
              <span className="grow">{item.message}</span>
              <button type="button" className="toast__close" onClick={() => dismiss(item.id)} aria-label="Fechar aviso">
                <X size={16} aria-hidden="true" />
              </button>
            </div>
          );
        })}
      </div>
    </ToastContext>
  );
}

export function useToast(): ToastApi {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error('useToast precisa estar dentro de <ToastProvider>');
  return ctx;
}

/** Lê o "flash" gravado pelo servidor (cookie de 30s) e mostra como toast uma única vez. */
export function FlashToaster() {
  const { toast } = useToast();
  useEffect(() => {
    const match = document.cookie.split('; ').find((c) => c.startsWith('la_flash='));
    if (!match) return;
    document.cookie = 'la_flash=; Max-Age=0; path=/';
    try {
      const data = JSON.parse(decodeURIComponent(match.slice('la_flash='.length))) as { kind: ToastKind; message: string };
      if (data?.message) toast(data.kind ?? 'info', data.message);
    } catch {
      /* cookie inválido: ignora */
    }
  }, [toast]);
  return null;
}

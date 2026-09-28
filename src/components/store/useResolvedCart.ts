'use client';

import { useEffect, useState } from 'react';
import type { CartInputLine } from '@/lib/store-cart';
import type { CartResolution } from '@/server/services/store';

interface State {
  key: string;
  data: CartResolution | null;
  failed: boolean;
}

export interface ResolvedCart {
  /** Últimos dados conferidos pelo servidor (pode estar um instante atrás da quantidade digitada). */
  data: CartResolution | null;
  /** Ainda conferindo o que mudou. */
  loading: boolean;
  /** Não foi possível falar com o servidor. */
  failed: boolean;
}

/** Pede ao servidor preço, estoque e problemas das linhas do carrinho (com um pequeno atraso para juntar cliques). */
export function useResolvedCart(items: readonly CartInputLine[]): ResolvedCart {
  const key = JSON.stringify(items);
  const [state, setState] = useState<State>({ key: '', data: null, failed: false });

  useEffect(() => {
    const lines = JSON.parse(key) as CartInputLine[];
    if (lines.length === 0) return;
    let canceled = false;
    const timer = window.setTimeout(async () => {
      try {
        const response = await fetch('/api/loja/carrinho', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ items: lines }),
          cache: 'no-store',
        });
        if (!response.ok) throw new Error(String(response.status));
        const data = (await response.json()) as CartResolution;
        if (!canceled) setState({ key, data, failed: false });
      } catch {
        if (!canceled) setState((previous) => ({ key, data: previous.data, failed: true }));
      }
    }, 120);
    return () => {
      canceled = true;
      window.clearTimeout(timer);
    };
  }, [key]);

  return { data: items.length === 0 ? null : state.data, loading: items.length > 0 && state.key !== key, failed: items.length > 0 && state.failed && state.key === key };
}

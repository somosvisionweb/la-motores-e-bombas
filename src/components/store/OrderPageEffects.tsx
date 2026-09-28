'use client';

import { useEffect } from 'react';
import { clearCart } from './cart-store';
import { rememberOrder } from './orders-history';

/**
 * Página do pedido: guarda o pedido nos "pedidos recentes" deste aparelho e, quando acabou de ser enviado
 * (`?novo=1`), esvazia o carrinho (o pedido já está na loja) e tira o `?novo=1` do endereço — assim copiar/compartilhar
 * o link não limpa o carrinho de outra pessoa nem repete o aviso.
 */
export function OrderPageEffects({ token, number, justPlaced }: { token: string; number: number; justPlaced: boolean }) {
  useEffect(() => {
    rememberOrder({ token, number });
    if (!justPlaced) return;
    clearCart();
    const url = new URL(window.location.href);
    if (url.searchParams.has('novo')) {
      url.searchParams.delete('novo');
      window.history.replaceState(window.history.state, '', `${url.pathname}${url.search}`);
    }
  }, [token, number, justPlaced]);
  return null;
}

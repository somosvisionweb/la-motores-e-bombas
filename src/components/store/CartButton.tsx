'use client';

import { ShoppingCart } from 'lucide-react';
import { setCartDrawerOpen, useCart, useCartDrawer } from './cart-store';

/** Botão do carrinho no cabeçalho: mostra a quantidade de itens e abre a gaveta do carrinho. */
export function CartButton() {
  const { count } = useCart();
  const { open } = useCartDrawer();
  return (
    <button
      type="button"
      className="site-cart"
      aria-label={count > 0 ? `Abrir carrinho (${count} ${count === 1 ? 'item' : 'itens'})` : 'Abrir carrinho'}
      aria-haspopup="dialog"
      aria-expanded={open}
      aria-controls="cart-drawer"
      onClick={() => setCartDrawerOpen(true)}
    >
      <ShoppingCart aria-hidden="true" />
      {count > 0 ? (
        <span className="site-cart__count" aria-hidden="true">
          {count > 99 ? '99+' : count}
        </span>
      ) : null}
    </button>
  );
}

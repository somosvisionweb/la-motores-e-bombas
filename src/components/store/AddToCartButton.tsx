'use client';

import { ShoppingCart } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { CART_MAX_QTY } from '@/config/store';
import { cn } from '@/lib/cn';
import { addToCart, setCartDrawerOpen } from './cart-store';
import { QuantityStepper } from './QuantityStepper';

/** Botão "Adicionar ao carrinho" dos cartões da loja. Abre a gaveta do carrinho depois de adicionar. */
export function AddToCartButton({
  productId,
  name,
  available,
  block,
  variant = 'primary',
}: {
  productId: number;
  name: string;
  available: number;
  block?: boolean;
  variant?: 'primary' | 'secondary';
}) {
  const [notice, setNotice] = useState<string | null>(null);

  function add() {
    const result = addToCart(productId, 1, available);
    if (result.full) {
      setNotice('O carrinho está cheio. Finalize este pedido para comprar mais itens.');
      window.setTimeout(() => setNotice(null), 4000);
      return;
    }
    if (result.capped) {
      setNotice(`Você já tem o máximo disponível (${result.quantity}) no carrinho.`);
      window.setTimeout(() => setNotice(null), 4000);
    }
    setCartDrawerOpen(true);
  }

  return (
    <>
      <button type="button" className={cn('btn', variant === 'primary' && 'btn--primary', block && 'btn--block')} onClick={add} aria-label={`Adicionar ${name} ao carrinho`}>
        <ShoppingCart aria-hidden="true" /> Adicionar
      </button>
      {notice ? (
        <p className="store-notice" role="status">
          {notice}
        </p>
      ) : null}
    </>
  );
}

/** Compra na página do produto: escolhe a quantidade e adiciona (ou compra agora, indo direto ao checkout). */
export function BuyBox({ productId, name, available }: { productId: number; name: string; available: number }) {
  const router = useRouter();
  const [quantity, setQuantity] = useState(1);
  const [notice, setNotice] = useState<string | null>(null);
  const max = Math.max(1, Math.min(CART_MAX_QTY, available));

  function add(goToCheckout: boolean) {
    const result = addToCart(productId, quantity, available);
    if (result.full) {
      setNotice('O carrinho está cheio. Finalize este pedido para comprar mais itens.');
      return;
    }
    if (result.capped) setNotice(`Você já tem o máximo disponível (${result.quantity}) no carrinho.`);
    else setNotice(null);
    if (goToCheckout) router.push('/loja/finalizar');
    else setCartDrawerOpen(true);
  }

  return (
    <div className="buybox">
      <div className="buybox__row">
        <QuantityStepper value={quantity} max={max} label={`Quantidade de ${name}`} onChange={setQuantity} />
        <span className="buybox__stock">{available <= 5 ? `Restam ${available}` : `${available} disponíveis`}</span>
      </div>
      <div className="buybox__actions">
        <button type="button" className="btn btn--primary btn--lg" onClick={() => add(false)}>
          <ShoppingCart aria-hidden="true" /> Adicionar ao carrinho
        </button>
        <button type="button" className="btn btn--lg" onClick={() => add(true)}>
          Comprar agora
        </button>
      </div>
      {notice ? (
        <p className="store-notice" role="status">
          {notice}
        </p>
      ) : null}
    </div>
  );
}

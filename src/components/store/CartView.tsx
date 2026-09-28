'use client';

import Link from 'next/link';
import { ShoppingCart, Trash2, TriangleAlert } from 'lucide-react';
import { ProductIcon } from '@/components/ui/ProductIcon';
import { CART_MAX_QTY } from '@/config/store';
import { formatBRL } from '@/lib/money';
import type { CartLine } from '@/server/services/store';
import { formatStoreOrderCode } from '@/lib/codes';
import { removeFromCart, replaceCart, setCartQuantity, useCart } from './cart-store';
import { useRecentOrders } from './orders-history';
import { QuantityStepper } from './QuantityStepper';
import { useResolvedCart } from './useResolvedCart';

const ISSUE_TEXT: Record<NonNullable<CartLine['issue']>, string> = {
  UNAVAILABLE: 'Este produto não está mais disponível para compra online.',
  OUT_OF_STOCK: 'Produto esgotado no momento.',
  INSUFFICIENT: 'Não temos essa quantidade em estoque.',
};

/** Carrinho completo (gaveta ou página): linhas com quantidade, remoção, problemas de estoque e resumo. */
export function CartView({ variant, onNavigate }: { variant: 'drawer' | 'page'; onNavigate?: () => void }) {
  const { items } = useCart();
  const { data, loading, failed } = useResolvedCart(items);
  const recentOrders = useRecentOrders();

  if (items.length === 0) {
    return (
      <div className="cart-empty">
        <span className="cart-empty__icon">
          <ShoppingCart aria-hidden="true" />
        </span>
        <p className="cart-empty__title">Seu carrinho está vazio</p>
        <p>Escolha os produtos na loja e eles aparecem aqui.</p>
        <Link href="/loja" className="btn btn--primary" onClick={onNavigate}>
          Ver produtos da loja
        </Link>
        {recentOrders.length > 0 ? (
          <div className="cart-empty__orders">
            <p>Seus pedidos recentes</p>
            <ul>
              {recentOrders.map((order) => (
                <li key={order.token}>
                  <Link href={`/loja/pedido/${order.token}`} onClick={onNavigate}>
                    Acompanhar pedido {formatStoreOrderCode(order.number)}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        ) : null}
      </div>
    );
  }

  const byId = new Map((data?.lines ?? []).map((line) => [line.productId, line]));
  const missing = new Set(data?.missingIds ?? []);
  const hasIssues = Boolean(data?.hasIssues) || missing.size > 0;
  const subtotal = items.reduce((sum, item) => {
    const line = byId.get(item.id);
    return line && !line.issue ? sum + line.unitPriceCents * item.qty : sum;
  }, 0);
  const ready = Boolean(data) && !loading && !hasIssues && !failed;

  function fixCart() {
    replaceCart(
      items.flatMap((item) => {
        const line = byId.get(item.id);
        if (missing.has(item.id)) return [];
        if (!line) return [item];
        if (line.issue === 'UNAVAILABLE' || line.issue === 'OUT_OF_STOCK') return [];
        if (line.issue === 'INSUFFICIENT') return [{ id: item.id, qty: line.available }];
        return [item];
      }),
    );
  }

  return (
    <div className={`cart cart--${variant}`}>
      <ul className="cart__list">
        {items.map((item) => {
          const line = byId.get(item.id);
          if (missing.has(item.id)) {
            return (
              <li key={item.id} className="cart-line cart-line--problem cart-line--missing">
                <div className="cart-line__body">
                  <p className="cart-line__name">Produto indisponível</p>
                  <p className="cart-line__issue">
                    <TriangleAlert aria-hidden="true" /> Este produto saiu da loja.
                  </p>
                </div>
                <button type="button" className="cart-line__remove" onClick={() => removeFromCart(item.id)} aria-label="Remover produto indisponível">
                  <Trash2 aria-hidden="true" />
                </button>
              </li>
            );
          }
          if (!line) {
            return (
              <li key={item.id} className="cart-line cart-line--loading" aria-busy="true">
                <span className="cart-line__media skeleton" />
                <div className="cart-line__body">
                  <span className="skeleton skeleton--line" />
                  <span className="skeleton skeleton--line skeleton--short" />
                </div>
              </li>
            );
          }
          const blocked = line.issue === 'UNAVAILABLE' || line.issue === 'OUT_OF_STOCK';
          const max = Math.max(1, Math.min(CART_MAX_QTY, line.available));
          return (
            <li key={item.id} className={`cart-line${line.issue ? ' cart-line--problem' : ''}`}>
              <Link href={line.href} className="cart-line__media" onClick={onNavigate} aria-label={`Ver ${line.name}`}>
                {line.imageFileId ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={`/media/${line.imageFileId}`} alt="" loading="lazy" />
                ) : (
                  <ProductIcon iconKey={line.iconKey} size={30} />
                )}
              </Link>
              <div className="cart-line__body">
                <Link href={line.href} className="cart-line__name" onClick={onNavigate}>
                  {line.name}
                </Link>
                <p className="cart-line__meta">
                  {formatBRL(line.unitPriceCents)} / {line.unit}
                  {line.isDemoPrice ? <span className="store-tag store-tag--demo">Preço de demonstração</span> : null}
                </p>
                {line.issue ? (
                  <p className="cart-line__issue" role="alert">
                    <TriangleAlert aria-hidden="true" />
                    {line.issue === 'INSUFFICIENT' ? `Só temos ${line.available} em estoque.` : ISSUE_TEXT[line.issue]}
                  </p>
                ) : null}
                {!blocked ? (
                  <div className="cart-line__controls">
                    <QuantityStepper value={item.qty} max={max} size="sm" label={`Quantidade de ${line.name}`} onChange={(next) => setCartQuantity(item.id, next)} />
                    <span className="cart-line__total">{formatBRL(line.unitPriceCents * item.qty)}</span>
                  </div>
                ) : null}
              </div>
              <button type="button" className="cart-line__remove" onClick={() => removeFromCart(item.id)} aria-label={`Remover ${line.name} do carrinho`}>
                <Trash2 aria-hidden="true" />
              </button>
            </li>
          );
        })}
      </ul>

      <div className="cart-summary">
        {hasIssues ? (
          <div className="cart-summary__alert" role="alert">
            <TriangleAlert aria-hidden="true" />
            <div>
              <p>Alguns itens precisam de ajuste antes de finalizar.</p>
              <button type="button" className="btn btn--sm" onClick={fixCart}>
                Corrigir carrinho
              </button>
            </div>
          </div>
        ) : null}
        {failed ? <p className="cart-summary__alert">Não foi possível conferir os preços agora. Verifique sua conexão e tente de novo.</p> : null}
        {data?.hasDemo ? (
          <p className="cart-summary__demo">
            <strong>Demonstração:</strong> os preços deste carrinho são fictícios. O pedido será apenas um teste.
          </p>
        ) : null}
        <dl className="cart-summary__rows">
          <div>
            <dt>Subtotal</dt>
            <dd className="tabular">{data ? formatBRL(subtotal) : '—'}</dd>
          </div>
        </dl>
        <p className="cart-summary__note">Entrega (quando disponível) e forma de pagamento são escolhidas no próximo passo.</p>
        {ready ? (
          <Link href="/loja/finalizar" className="btn btn--primary btn--lg btn--block" onClick={onNavigate}>
            Finalizar compra
          </Link>
        ) : (
          <button type="button" className="btn btn--primary btn--lg btn--block" disabled aria-disabled="true">
            {loading ? 'Conferindo estoque…' : 'Finalizar compra'}
          </button>
        )}
        {variant === 'drawer' ? (
          <Link href="/loja/carrinho" className="btn btn--ghost btn--block" onClick={onNavigate}>
            Ver carrinho completo
          </Link>
        ) : (
          <Link href="/loja" className="btn btn--ghost btn--block">
            Continuar comprando
          </Link>
        )}
      </div>
    </div>
  );
}

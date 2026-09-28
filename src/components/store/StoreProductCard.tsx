import Link from 'next/link';
import { ProductIcon } from '@/components/ui/ProductIcon';
import { WhatsAppIcon } from '@/components/ui/brand-icons';
import { formatBRL } from '@/lib/money';
import { linkProps } from '@/lib/site-links';
import type { StoreProductState } from '@/lib/store-pricing';
import type { StoreProduct } from '@/server/services/store';
import { AddToCartButton } from './AddToCartButton';

const STATE_TEXT: Record<StoreProductState, string> = {
  AVAILABLE: 'Em estoque',
  LAST_UNITS: 'Últimas unidades',
  OUT_OF_STOCK: 'Esgotado no momento',
  CONSULT: 'Consulte a disponibilidade',
};

export function StoreProductCard({ product, consultHref }: { product: StoreProduct; consultHref: string }) {
  const showState = product.state !== 'CONSULT' || product.priceCents !== null;
  return (
    <article className="store-card">
      <Link href={product.href} className="store-card__media" aria-label={`Ver ${product.name}`}>
        {product.imageFileId ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={`/media/${product.imageFileId}`} alt="" loading="lazy" />
        ) : (
          <ProductIcon iconKey={product.iconKey} size={54} />
        )}
        {product.isDemoPrice ? <span className="store-tag store-tag--demo">Demonstração</span> : null}
      </Link>
      <div className="store-card__body">
        <p className="store-card__cat">{product.category}</p>
        <h3 className="store-card__name">
          <Link href={product.href}>{product.name}</Link>
        </h3>
        <p className="store-card__price">
          {product.priceCents !== null ? (
            <>
              <strong>{formatBRL(product.priceCents)}</strong>
              <span> / {product.unit}</span>
            </>
          ) : (
            <span className="store-card__consult">Valor sob consulta</span>
          )}
        </p>
        <p className={`store-card__state store-card__state--${product.state.toLowerCase()}`}>{showState ? STATE_TEXT[product.state] : STATE_TEXT.CONSULT}</p>
        <div className="store-card__action">
          {product.purchasable ? (
            <AddToCartButton productId={product.id} name={product.name} available={product.available} block />
          ) : (
            <a href={consultHref} className="btn btn--block" {...linkProps(consultHref)}>
              <WhatsAppIcon /> {product.state === 'OUT_OF_STOCK' ? 'Consultar reposição' : 'Consultar valor'}
            </a>
          )}
        </div>
      </div>
    </article>
  );
}

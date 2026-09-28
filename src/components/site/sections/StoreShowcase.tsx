import Link from 'next/link';
import { ArrowRight } from 'lucide-react';
import { StoreDemoBanner } from '@/components/store/StoreDemoBanner';
import { StoreProductCard } from '@/components/store/StoreProductCard';
import { WhatsAppIcon } from '@/components/ui/brand-icons';
import { linkProps, type SiteLinks } from '@/lib/site-links';
import type { StoreCatalog } from '@/server/services/store';

/** Seção "Produtos" da página inicial quando a loja virtual está aberta: vitrine com preço e carrinho. */
export function StoreShowcase({ catalog, links, canBuy }: { catalog: StoreCatalog; links: SiteLinks; canBuy: boolean }) {
  const { products, config, demo } = catalog;
  const shown = products.slice(0, 10);
  const lead = canBuy
    ? `Compre pelo site e ${config.deliveryEnabled ? 'retire na loja ou receba em casa' : 'retire na loja'}. Para os demais itens, consulte a disponibilidade pelo WhatsApp.`
    : 'Consulte a disponibilidade e os valores diretamente pelo WhatsApp.';

  return (
    <section id="produtos" className="site-section" aria-labelledby="produtos-title">
      <div className="site-container">
        <div className="reveal">
          <p className="site-eyebrow">Produtos</p>
          <h2 id="produtos-title" className="site-title">
            Peças e componentes para motores e bombas
          </h2>
          <p className="site-lead">{lead}</p>
        </div>

        {demo ? <StoreDemoBanner compact /> : null}

        <ul className="store-grid store-grid--home">
          {shown.map((product, index) => (
            <li key={product.id} className="reveal" style={{ ['--i' as string]: index % 5 }}>
              <StoreProductCard product={product} consultHref={links.product(product.name)} />
            </li>
          ))}
        </ul>

        <div className="site-note reveal">
          <p>
            <strong>{products.length > shown.length ? `Veja todos os ${products.length} produtos na loja.` : 'Não encontrou a peça que procura?'}</strong> Fale com a gente pelo WhatsApp.
          </p>
          <div className="cluster" style={{ gap: 12 }}>
            <Link href="/loja" className="btn btn--brand">
              Ver a loja completa <ArrowRight aria-hidden="true" />
            </Link>
            <a href={links.general} className="btn btn--primary" {...linkProps(links.general)}>
              <WhatsAppIcon /> Falar no WhatsApp
            </a>
          </div>
        </div>
      </div>
    </section>
  );
}

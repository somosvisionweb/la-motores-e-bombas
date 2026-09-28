import { ArrowRight } from 'lucide-react';
import { ProductIcon } from '@/components/ui/ProductIcon';
import { WhatsAppIcon } from '@/components/ui/brand-icons';
import { linkProps, type SiteLinks } from '@/lib/site-links';
import type { SiteData } from '@/server/services/site';

export function Products({ products, links }: { products: SiteData['products']; links: SiteLinks }) {
  if (products.length === 0) return null;

  return (
    <section id="produtos" className="site-section" aria-labelledby="produtos-title">
      <div className="site-container">
        <div className="reveal">
          <p className="site-eyebrow">Produtos</p>
          <h2 id="produtos-title" className="site-title">
            Peças e componentes para motores e bombas
          </h2>
          <p className="site-lead">Consulte a disponibilidade e os valores diretamente pelo WhatsApp.</p>
        </div>

        <ul className="site-products">
          {products.map((product, index) => {
            const href = links.product(product.name);
            return (
              <li key={product.id} className="reveal" style={{ ['--i' as string]: index % 4 }}>
                <a href={href} className="site-product" {...linkProps(href)}>
                  {product.imageFileId ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={`/media/${product.imageFileId}`} alt={product.name} className="site-product__photo" loading="lazy" />
                  ) : (
                    <span className="site-product__icon">
                      <ProductIcon iconKey={product.iconKey} size={38} />
                    </span>
                  )}
                  <h3>{product.name}</h3>
                  <p>
                    Consultar disponibilidade <ArrowRight aria-hidden="true" style={{ display: 'inline', width: 12, height: 12, verticalAlign: -1 }} />
                  </p>
                </a>
              </li>
            );
          })}
        </ul>

        <div className="site-note reveal">
          <p>
            <strong>Não encontrou a peça que procura?</strong> Fale com a gente pelo WhatsApp.
          </p>
          <a href={links.general} className="btn btn--primary" {...linkProps(links.general)}>
            <WhatsAppIcon /> Falar no WhatsApp
          </a>
        </div>
      </div>
    </section>
  );
}

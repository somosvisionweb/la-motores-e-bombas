import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound, permanentRedirect } from 'next/navigation';
import { CircleCheck, MapPin, Pencil, QrCode, ShoppingBag } from 'lucide-react';
import { BuyBox } from '@/components/store/AddToCartButton';
import { StoreDemoBanner } from '@/components/store/StoreDemoBanner';
import { StoreHero } from '@/components/store/StoreHero';
import { StoreProductCard } from '@/components/store/StoreProductCard';
import { ProductIcon } from '@/components/ui/ProductIcon';
import { WhatsAppIcon } from '@/components/ui/brand-icons';
import { fullAddress } from '@/lib/company';
import { formatBRL } from '@/lib/money';
import { serializeJsonLd } from '@/lib/seo';
import { buildSiteLinks, linkProps } from '@/lib/site-links';
import { storeMetadata } from '@/lib/store-seo';
import { parseProductParam, productPath } from '@/lib/store-pricing';
import { getSessionUser } from '@/server/auth/session';
import { hasPermission } from '@/server/auth/types';
import { getSiteBaseUrl, getSiteData } from '@/server/services/site';
import { getStoreProduct, listRelatedStoreProducts } from '@/server/services/store';

type Props = { params: Promise<{ slug: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const id = parseProductParam(slug);
  const found = id ? await getStoreProduct(id) : null;
  if (!found) return { title: 'Produto não encontrado', robots: { index: false, follow: false } };
  const { company } = await getSiteData();
  const { product } = found;
  const price = product.priceCents !== null && !product.isDemoPrice ? ` por ${formatBRL(product.priceCents)}` : '';
  return storeMetadata({
    title: `${product.name} — ${product.category}`,
    description: product.description?.slice(0, 160) || `${product.name} para motores elétricos e bombas${price}. Compre online e retire na loja ou consulte a disponibilidade pelo WhatsApp.`,
    path: productPath(product.id, product.name),
    siteName: company.name,
    image: product.imageFileId ? `/media/${product.imageFileId}` : null,
  });
}

export default async function ProductPage({ params }: Props) {
  const { slug } = await params;
  const id = parseProductParam(slug);
  const found = id ? await getStoreProduct(id) : null;
  if (!found) notFound();
  const { product, config } = found;

  // Endereço canônico com o nome do produto (ex.: /loja/produto/12 → /loja/produto/12-rolamentos).
  const canonical = productPath(product.id, product.name);
  if (`/loja/produto/${slug}` !== canonical) permanentRedirect(canonical);

  const [site, related, sessionUser] = await Promise.all([getSiteData(), listRelatedStoreProducts(product, 4), getSessionUser()]);
  // Atalho só para quem pode editar produtos (equipe logada).
  const canEdit = Boolean(sessionUser && !sessionUser.mustChangePassword && hasPermission(sessionUser, 'products.manage'));
  const { company } = site;
  const links = buildSiteLinks(company);
  const baseUrl = await getSiteBaseUrl(company);
  const address = fullAddress(company);
  const pixInfo = Boolean(config.pixKey) || product.isDemoPrice;

  // Dados estruturados só com preço REAL (nunca com preço de demonstração).
  const jsonLd =
    product.priceCents !== null && !product.isDemoPrice
      ? {
          '@context': 'https://schema.org',
          '@type': 'Product',
          name: product.name,
          category: product.category,
          ...(product.description ? { description: product.description } : {}),
          ...(product.imageFileId ? { image: `${baseUrl}/media/${product.imageFileId}` } : {}),
          offers: {
            '@type': 'Offer',
            url: `${baseUrl}${canonical}`,
            priceCurrency: 'BRL',
            price: (product.priceCents / 100).toFixed(2),
            availability: product.purchasable ? 'https://schema.org/InStock' : 'https://schema.org/OutOfStock',
            seller: { '@type': 'Organization', name: company.name },
          },
        }
      : null;

  return (
    <>
      <StoreHero title={product.name} crumbs={[{ label: 'Início', href: '/' }, { label: 'Loja', href: '/loja' }, { label: product.name }]} />

      <section className="site-section store-page">
        <div className="site-container">
          {product.isDemoPrice ? <StoreDemoBanner /> : null}

          <div className="product">
            <div className="product__media">
              {product.imageFileId ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={`/media/${product.imageFileId}`} alt={product.name} />
              ) : (
                <ProductIcon iconKey={product.iconKey} size={140} />
              )}
            </div>

            <div className="product__info">
              {canEdit ? (
                <Link href={`/sistema/produtos/${product.id}?origem=loja`} className="store-admin-chip">
                  <Pencil aria-hidden="true" /> Editar este produto
                </Link>
              ) : null}
              <p className="product__cat">{product.category}</p>
              {product.priceCents !== null ? (
                <p className="product__price">
                  <strong>{formatBRL(product.priceCents)}</strong> <span>/ {product.unit}</span>
                  {product.isDemoPrice ? <span className="store-tag store-tag--demo">Preço de demonstração</span> : null}
                </p>
              ) : (
                <p className="product__price product__price--consult">Valor sob consulta</p>
              )}

              {product.purchasable ? (
                <>
                  <p className={`product__state product__state--${product.state.toLowerCase()}`}>
                    <CircleCheck aria-hidden="true" /> {product.state === 'LAST_UNITS' ? 'Últimas unidades em estoque' : 'Em estoque'}
                  </p>
                  <BuyBox productId={product.id} name={product.name} available={product.available} />
                </>
              ) : (
                <>
                  <p className="product__state product__state--consult">
                    {product.state === 'OUT_OF_STOCK'
                      ? 'Esgotado no momento. Fale com a gente para consultar a reposição.'
                      : 'Este produto não está à venda online agora. Fale com a gente para consultar valor e disponibilidade.'}
                  </p>
                  <a href={links.product(product.name)} className="btn btn--primary btn--lg" {...linkProps(links.product(product.name))}>
                    <WhatsAppIcon /> Consultar pelo WhatsApp
                  </a>
                </>
              )}

              {product.description ? (
                <div className="product__desc">
                  <h2>Sobre o produto</h2>
                  <p>{product.description}</p>
                </div>
              ) : null}

              <ul className="product__facts">
                <li>
                  <MapPin aria-hidden="true" />
                  <span>
                    <strong>Retirada na loja</strong>
                    {address ? ` — ${address}` : ''}
                  </span>
                </li>
                <li>
                  <ShoppingBag aria-hidden="true" />
                  <span>
                    <strong>Como comprar:</strong> adicione ao carrinho, escolha {config.deliveryEnabled ? 'retirada ou entrega' : 'retirar na loja'} e finalize o pedido. A loja confirma e avisa quando estiver pronto.
                  </span>
                </li>
                <li>
                  <QrCode aria-hidden="true" />
                  <span>
                    <strong>Pagamento:</strong> {pixInfo ? 'PIX (QR Code ou copia e cola) ou ' : ''}na retirada.
                  </span>
                </li>
              </ul>
            </div>
          </div>

          {related.length > 0 ? (
            <div className="product__related">
              <h2>Outros produtos</h2>
              <ul className="store-grid">
                {related.map((item) => (
                  <li key={item.id}>
                    <StoreProductCard product={item} consultHref={links.product(item.name)} />
                  </li>
                ))}
              </ul>
              <p>
                <Link href="/loja" className="btn">
                  Ver todos os produtos
                </Link>
              </p>
            </div>
          ) : null}
        </div>
      </section>

      {jsonLd ? <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: serializeJsonLd(jsonLd) }} /> : null}
    </>
  );
}

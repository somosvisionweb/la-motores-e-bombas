import type { Metadata } from 'next';
import Link from 'next/link';
import { Search } from 'lucide-react';
import { StoreClosed, StoreHero } from '@/components/store/StoreHero';
import { StoreDemoBanner } from '@/components/store/StoreDemoBanner';
import { StoreProductCard } from '@/components/store/StoreProductCard';
import { WhatsAppIcon } from '@/components/ui/brand-icons';
import { cityLine } from '@/lib/company';
import { param, type SearchParams } from '@/lib/query';
import { buildSiteLinks, linkProps } from '@/lib/site-links';
import { storeMetadata } from '@/lib/store-seo';
import { listStoreProducts, storeHasSellableProducts, STORE_SORT_KEYS, type StoreSortKey } from '@/server/services/store';
import { expireStaleStoreOrders } from '@/server/services/store-orders';
import { getSiteData } from '@/server/services/site';

const SORT_LABEL: Record<StoreSortKey, string> = {
  relevancia: 'Destaques',
  nome: 'Nome (A–Z)',
  'menor-preco': 'Menor preço',
  'maior-preco': 'Maior preço',
};

export async function generateMetadata(): Promise<Metadata> {
  const { company } = await getSiteData();
  const city = cityLine(company);
  return storeMetadata({
    title: 'Loja virtual de peças para motores e bombas',
    description: `Rolamentos, capacitores, selo mecânico e outras peças para motores elétricos e bombas. Compre online e retire na loja${city ? ` em ${city}` : ''}.`,
    path: '/loja',
    siteName: company.name,
  });
}

export default async function StorePage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const params = await searchParams;
  const q = param(params, 'q');
  const category = param(params, 'categoria');
  const requestedSort = param(params, 'ordem') as StoreSortKey;
  const sort: StoreSortKey = STORE_SORT_KEYS.includes(requestedSort) ? requestedSort : 'relevancia';

  await expireStaleStoreOrders();
  const [site, catalog, canBuy] = await Promise.all([getSiteData(), listStoreProducts({ q, category: category || undefined, sort }), storeHasSellableProducts()]);
  const links = buildSiteLinks(site.company);
  const { config } = catalog;
  const filtered = Boolean(q || category || sort !== 'relevancia');
  const pixInfo = Boolean(config.pixKey) || catalog.demo;

  if (!config.enabled) {
    return (
      <>
        <StoreHero title="Loja virtual" lead="Peças e componentes para motores elétricos e bombas." />
        <StoreClosed whatsappHref={links.general} />
      </>
    );
  }

  return (
    <>
      <StoreHero
        title="Peças e componentes para motores e bombas"
        lead={
          canBuy
            ? `Compre pelo site e ${config.deliveryEnabled ? 'retire na loja ou receba em casa' : 'retire na loja'}. Pague ${pixInfo ? 'por PIX ou ' : ''}na retirada.`
            : 'Veja os produtos e consulte o valor e a disponibilidade direto pelo WhatsApp.'
        }
        crumbs={[{ label: 'Início', href: '/' }, { label: 'Loja' }]}
      >
        {canBuy ? (
          <ul className="store-perks">
            <li>Retirada na loja</li>
            {config.deliveryEnabled ? <li>Entrega</li> : null}
            {pixInfo ? <li>Pagamento por PIX</li> : null}
            <li>Pagamento na retirada</li>
          </ul>
        ) : null}
      </StoreHero>

      <section className="site-section store-page">
        <div className="site-container">
          {catalog.demo ? <StoreDemoBanner /> : null}

          <form method="get" action="/loja" className="store-filters" role="search" aria-label="Buscar e filtrar produtos">
            <label className="store-filters__search">
              <span className="sr-only">Buscar produto</span>
              <Search aria-hidden="true" />
              <input type="search" name="q" defaultValue={q} placeholder="Buscar produto (ex.: capacitor, rolamento)" autoComplete="off" maxLength={80} />
            </label>
            <label>
              <span className="sr-only">Categoria</span>
              <select name="categoria" defaultValue={category} aria-label="Categoria">
                <option value="">Todas as categorias</option>
                {catalog.categories.map((c) => (
                  <option key={c.name} value={c.name}>
                    {c.name} ({c.count})
                  </option>
                ))}
              </select>
            </label>
            <label>
              <span className="sr-only">Ordenar por</span>
              <select name="ordem" defaultValue={sort} aria-label="Ordenar por">
                {STORE_SORT_KEYS.map((key) => (
                  <option key={key} value={key}>
                    {SORT_LABEL[key]}
                  </option>
                ))}
              </select>
            </label>
            <button type="submit" className="btn btn--primary">
              Filtrar
            </button>
            {filtered ? (
              <Link href="/loja" className="btn btn--ghost">
                Limpar
              </Link>
            ) : null}
          </form>

          <h2 className="sr-only">Produtos da loja</h2>
          <p className="store-count" role="status">
            {catalog.products.length === 0 ? 'Nenhum produto encontrado' : `${catalog.products.length} ${catalog.products.length === 1 ? 'produto' : 'produtos'}`}
            {q ? <> para “{q}”</> : null}
          </p>

          {catalog.products.length > 0 ? (
            <ul className="store-grid" aria-label="Produtos">
              {catalog.products.map((product) => (
                <li key={product.id}>
                  <StoreProductCard product={product} consultHref={links.product(product.name)} />
                </li>
              ))}
            </ul>
          ) : (
            <div className="store-empty">
              <p>Não encontramos produtos com esse filtro.</p>
              <Link href="/loja" className="btn">
                Ver todos os produtos
              </Link>
            </div>
          )}

          <div className="site-note">
            <p>
              <strong>Não encontrou a peça que procura?</strong> Fale com a gente pelo WhatsApp.
            </p>
            <a href={links.general} className="btn btn--primary" {...linkProps(links.general)}>
              <WhatsAppIcon /> Falar no WhatsApp
            </a>
          </div>
        </div>
      </section>
    </>
  );
}

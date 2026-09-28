import type { Metadata } from 'next';
import { CartView } from '@/components/store/CartView';
import { StoreClosed, StoreHero } from '@/components/store/StoreHero';
import { buildSiteLinks } from '@/lib/site-links';
import { storeMetadata } from '@/lib/store-seo';
import { getSiteData } from '@/server/services/site';
import { getStoreSettings } from '@/server/services/store-settings';

export async function generateMetadata(): Promise<Metadata> {
  const { company } = await getSiteData();
  return storeMetadata({ title: 'Carrinho', description: 'Seu carrinho de compras.', path: '/loja/carrinho', siteName: company.name, noindex: true });
}

export default async function CartPage() {
  const [site, config] = await Promise.all([getSiteData(), getStoreSettings()]);
  if (!config.enabled) {
    return (
      <>
        <StoreHero title="Carrinho" />
        <StoreClosed whatsappHref={buildSiteLinks(site.company).general} />
      </>
    );
  }
  return (
    <>
      <StoreHero title="Seu carrinho" crumbs={[{ label: 'Início', href: '/' }, { label: 'Loja', href: '/loja' }, { label: 'Carrinho' }]} />
      <section className="site-section store-page">
        <div className="site-container">
          <CartView variant="page" />
        </div>
      </section>
    </>
  );
}
